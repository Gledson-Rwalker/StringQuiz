import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  id: string
  name: string
  socketId: string
  score: number
}

interface PlayerAnswer {
  playerId: string
  optionId: string
  numericAnswer: number | null
  timeElapsed: number
  isCorrect: boolean
  score: number
}

interface QuestionOption {
  id: string
  text: string
  color: string
}

interface Question {
  id: string
  text: string
  type: string // 'multiple_choice' | 'numeric'
  timeLimit: number
  options: QuestionOption[]
  correctNumericAnswer?: number | null
}

interface PendingQuestion {
  questionIndex: number
  question: Question
  readyPlayers: Set<string> // playerIds who clicked PRONTO
  timer: NodeJS.Timeout | null
}

interface GameRoom {
  sessionId: string
  pin: string
  hostSocketId: string
  players: Map<string, PlayerInfo>
  currentQuestionIndex: number
  status: 'waiting' | 'preparing' | 'active' | 'finished'
  answers: Map<string, PlayerAnswer[]> // questionId -> array of answers
  questionTimers: Map<string, NodeJS.Timeout> // questionId -> timer
  currentQuestionId: string | null
  currentQuestionType: string | null
  currentCorrectNumericAnswer: number | null
  currentQuestionTimeLimit: number
  pendingQuestion: PendingQuestion | null
}

// ─── In-Memory State ─────────────────────────────────────────────────────────

const gameRooms = new Map<string, GameRoom>() // sessionId -> GameRoom
const pinToSession = new Map<string, string>() // pin -> sessionId
const playerSessionMap = new Map<string, string>() // playerId -> sessionId
const socketToPlayer = new Map<string, { playerId: string; sessionId: string }>() // socketId -> { playerId, sessionId }
const socketToHost = new Map<string, string>() // hostSocketId -> sessionId

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePin(): string {
  let pin: string
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString()
  } while (pinToSession.has(pin))
  return pin
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

function calculateScore(isCorrect: boolean, timeElapsed: number, timeLimit: number): number {
  if (!isCorrect) return 0
  const baseScore = 1000
  const speedBonus = Math.max(0, ((timeLimit - timeElapsed) / timeLimit) * 500)
  return Math.round(baseScore + speedBonus)
}

/**
 * Calculate score for numeric answers based on proximity to the correct answer
 * and speed of response.
 *
 * - Exact answer: 1000 base points
 * - Proximity: Uses relative error to determine how close the answer is
 * - Speed bonus: Up to 500 points based on how fast the player answered
 * - Maximum score per question: 1500 points
 */
function calculateNumericScore(
  playerAnswer: number,
  correctAnswer: number,
  timeElapsed: number,
  timeLimit: number
): number {
  const distance = Math.abs(playerAnswer - correctAnswer)
  
  // If exact answer, full base score
  if (distance === 0) {
    const speedBonus = Math.max(0, ((timeLimit - timeElapsed) / timeLimit) * 500)
    return Math.round(1000 + speedBonus)
  }

  // Calculate relative error with a minimum denominator to avoid extreme penalties for small numbers
  const denominator = Math.max(Math.abs(correctAnswer), 10)
  const relativeError = distance / denominator

  // Proximity score: 1000 * (1 - relativeError), minimum 0
  // At 100% relative error, score is 0
  const proximityScore = Math.max(0, Math.round(1000 * (1 - relativeError)))

  // Speed bonus: same formula as multiple choice but scaled by proximity factor
  // Faster answers get more bonus, but only if they're reasonably close
  const proximityFactor = Math.max(0.1, 1 - relativeError) // Don't let bonus go below 10%
  const speedBonus = Math.max(0, ((timeLimit - timeElapsed) / timeLimit) * 500 * proximityFactor)

  return Math.round(proximityScore + speedBonus)
}

function getLeaderboard(room: GameRoom): { name: string; score: number }[] {
  const leaderboard: { name: string; score: number }[] = []
  room.players.forEach((player) => {
    leaderboard.push({ name: player.name, score: player.score })
  })
  return leaderboard.sort((a, b) => b.score - a.score)
}

/**
 * Actually launch the question: broadcast question-start with full data and start timer.
 * Called when all players are ready OR host forces start.
 */
function launchQuestion(room: GameRoom) {
  if (!room.pendingQuestion) return

  const { question, questionIndex } = room.pendingQuestion

  // Clear any pending timeout
  if (room.pendingQuestion.timer) {
    clearTimeout(room.pendingQuestion.timer)
    room.pendingQuestion.timer = null
  }

  room.currentQuestionIndex = questionIndex
  room.currentQuestionId = question.id
  room.currentQuestionType = question.type
  room.currentCorrectNumericAnswer = question.correctNumericAnswer ?? null
  room.currentQuestionTimeLimit = question.timeLimit
  room.status = 'active'

  // Clear any previous answers for this question
  room.answers.set(question.id, [])

  // Clear any existing timer for this question
  const existingTimer = room.questionTimers.get(question.id)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const startTime = Date.now()

  // Broadcast question-start to all players in the session
  // For numeric questions, don't send the correct answer or options
  const questionForPlayers = question.type === 'numeric'
    ? {
        id: question.id,
        text: question.text,
        type: question.type,
        timeLimit: question.timeLimit,
        options: [], // No options for numeric questions
      }
    : {
        id: question.id,
        text: question.text,
        type: question.type,
        timeLimit: question.timeLimit,
        options: question.options,
      }

  console.log(`[Launch] Question ${questionIndex} launched in session ${room.sessionId}. Type: ${question.type}`)

  // Broadcast question-start to the entire room (host + players)
  io.to(room.sessionId).emit('question-start', {
    questionIndex,
    question: questionForPlayers,
    startTime,
  })

  // Also tell the host the full question (including correct answer info for host display)
  io.to(room.hostSocketId).emit('question-start', {
    questionIndex,
    question: {
      ...questionForPlayers,
      // Host gets full info
      correctNumericAnswer: question.correctNumericAnswer,
      options: question.options, // Host sees all options with full data
    },
    startTime,
  })

  // Start a timer for the question
  const timer = setTimeout(() => {
    console.log(
      `[Timer] Question ${question.id} time limit reached in session ${room.sessionId}`
    )
    const currentAnswers = room.answers.get(question.id) || []
    io.to(room.hostSocketId).emit('question-time-up', {
      sessionId: room.sessionId,
      questionId: question.id,
      questionIndex,
      answerCount: currentAnswers.length,
      totalPlayers: room.players.size,
    })
  }, question.timeLimit * 1000)

  room.questionTimers.set(question.id, timer)

  // Clear pending state
  room.pendingQuestion = null
}

// ─── Connection Handling ─────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[Connect] Socket connected: ${socket.id}`)

  // ─── Host Events ───────────────────────────────────────────────────────

  socket.on('host-create', (data: { sessionId: string }) => {
    const { sessionId } = data
    console.log(`[Host-Create] Creating game session: ${sessionId}`)

    // Clean up any existing room with this session
    const existingRoom = gameRooms.get(sessionId)
    if (existingRoom) {
      // Clear any active timers
      existingRoom.questionTimers.forEach((timer) => clearTimeout(timer))
      if (existingRoom.pendingQuestion?.timer) {
        clearTimeout(existingRoom.pendingQuestion.timer)
      }
      pinToSession.delete(existingRoom.pin)
    }

    const pin = generatePin()
    const room: GameRoom = {
      sessionId,
      pin,
      hostSocketId: socket.id,
      players: new Map(),
      currentQuestionIndex: -1,
      status: 'waiting',
      answers: new Map(),
      questionTimers: new Map(),
      currentQuestionId: null,
      currentQuestionType: null,
      currentCorrectNumericAnswer: null,
      currentQuestionTimeLimit: 30,
      pendingQuestion: null,
    }

    gameRooms.set(sessionId, room)
    pinToSession.set(pin, sessionId)
    socketToHost.set(socket.id, sessionId)
    socket.join(sessionId)

    console.log(`[Host-Create] Session ${sessionId} created with PIN: ${pin}`)
    socket.emit('session-created', { sessionId, pin })
  })

  /**
   * Host sends a question to be prepared (not yet started).
   * Players will see a "PRONTO!" button. When all are ready, question launches.
   */
  socket.on(
    'host-prepare-question',
    (data: { sessionId: string; questionIndex: number; question: Question }) => {
      const { sessionId, questionIndex, question } = data
      console.log(
        `[Host-Prepare-Question] Session: ${sessionId}, Question: ${questionIndex}, QID: ${question.id}, Type: ${question.type}`
      )

      const room = gameRooms.get(sessionId)
      if (!room) {
        console.error(`[Host-Prepare-Question] Room not found: ${sessionId}`)
        return
      }

      // Set room status to preparing
      room.status = 'preparing'

      // Create pending question with empty ready set
      room.pendingQuestion = {
        questionIndex,
        question,
        readyPlayers: new Set(),
        timer: null,
      }

      // Broadcast question-prepare to all players (with minimal info - no question text/options)
      io.to(sessionId).emit('question-prepare', {
        questionIndex,
        questionType: question.type,
        timeLimit: question.timeLimit,
        totalPlayers: room.players.size,
        readyCount: 0,
      })

      // Also notify host about the preparation state
      socket.emit('question-prepare', {
        questionIndex,
        questionType: question.type,
        timeLimit: question.timeLimit,
        totalPlayers: room.players.size,
        readyCount: 0,
      })

      console.log(
        `[Host-Prepare-Question] Question ${questionIndex} prepared in session ${sessionId}. Waiting for ${room.players.size} players to be ready.`
      )
    }
  )

  /**
   * Host forces the question to start even if not all players are ready.
   */
  socket.on('host-force-start', (data: { sessionId: string }) => {
    const { sessionId } = data
    console.log(`[Host-Force-Start] Session: ${sessionId}`)

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.error(`[Host-Force-Start] Room not found: ${sessionId}`)
      return
    }

    if (!room.pendingQuestion) {
      console.warn(`[Host-Force-Start] No pending question in session ${sessionId}`)
      return
    }

    launchQuestion(room)
  })

  socket.on(
    'host-start-question',
    (data: { sessionId: string; questionIndex: number; question: Question }) => {
      const { sessionId, questionIndex, question } = data
      console.log(
        `[Host-Start-Question] Session: ${sessionId}, Question: ${questionIndex}, QID: ${question.id}, Type: ${question.type}`
      )

      const room = gameRooms.get(sessionId)
      if (!room) {
        console.error(`[Host-Start-Question] Room not found: ${sessionId}`)
        return
      }

      room.currentQuestionIndex = questionIndex
      room.currentQuestionId = question.id
      room.currentQuestionType = question.type
      room.currentCorrectNumericAnswer = question.correctNumericAnswer ?? null
      room.currentQuestionTimeLimit = question.timeLimit
      room.status = 'active'

      // Clear any previous answers for this question
      room.answers.set(question.id, [])

      // Clear any existing timer for this question
      const existingTimer = room.questionTimers.get(question.id)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const startTime = Date.now()

      // Broadcast question-start to all players in the session
      // For numeric questions, don't send the correct answer or options
      const questionForPlayers = question.type === 'numeric'
        ? {
            id: question.id,
            text: question.text,
            type: question.type,
            timeLimit: question.timeLimit,
            options: [], // No options for numeric questions
          }
        : {
            id: question.id,
            text: question.text,
            type: question.type,
            timeLimit: question.timeLimit,
            options: question.options,
          }

      io.to(sessionId).emit('question-start', {
        questionIndex,
        question: questionForPlayers,
        startTime,
      })

      // Start a timer for the question
      const timer = setTimeout(() => {
        console.log(
          `[Timer] Question ${question.id} time limit reached in session ${sessionId}`
        )
        const currentAnswers = room.answers.get(question.id) || []
        io.to(room.hostSocketId).emit('question-time-up', {
          sessionId,
          questionId: question.id,
          questionIndex,
          answerCount: currentAnswers.length,
          totalPlayers: room.players.size,
        })
      }, question.timeLimit * 1000)

      room.questionTimers.set(question.id, timer)
    }
  )

  socket.on(
    'host-end-question',
    (data: {
      sessionId: string
      correctOptionId?: string
      correctNumericAnswer?: number
      questionIndex: number
    }) => {
      const { sessionId, correctOptionId, correctNumericAnswer, questionIndex } = data
      console.log(
        `[Host-End-Question] Session: ${sessionId}, CorrectOption: ${correctOptionId}, CorrectNumeric: ${correctNumericAnswer}, Index: ${questionIndex}`
      )

      const room = gameRooms.get(sessionId)
      if (!room) {
        console.error(`[Host-End-Question] Room not found: ${sessionId}`)
        return
      }

      // Clear the timer for this question
      const questionId = room.currentQuestionId
      if (questionId) {
        const timer = room.questionTimers.get(questionId)
        if (timer) {
          clearTimeout(timer)
          room.questionTimers.delete(questionId)
        }
      }

      const questionType = room.currentQuestionType
      const answers = room.answers.get(questionId || '') || []
      const timeLimit = room.currentQuestionTimeLimit

      if (questionType === 'numeric') {
        const correctAnswer = correctNumericAnswer ?? room.currentCorrectNumericAnswer ?? 0
        const answerResults: any[] = []

        answers.forEach((answer) => {
          if (answer.numericAnswer !== null) {
            const score = calculateNumericScore(answer.numericAnswer, correctAnswer, answer.timeElapsed, timeLimit)
            answer.isCorrect = answer.numericAnswer === correctAnswer
            answer.score = score
            const player = room.players.get(answer.playerId)
            if (player) player.score += score
            answerResults.push({ playerId: answer.playerId, numericAnswer: answer.numericAnswer, distance: Math.abs(answer.numericAnswer - correctAnswer), score, playerName: player?.name || 'Unknown' })
          }
        })
        answerResults.sort((a, b) => a.distance - b.distance)
        io.to(sessionId).emit('question-end', { correctNumericAnswer: correctAnswer, questionIndex, questionType: 'numeric', answerResults })

      } else if (questionType === 'multi_select') {
        // Lógica para Múltipla Seleção
        answers.forEach((answer) => {
          // O optionId aqui contém os IDs selecionados separados por vírgula
          const playerSelections = answer.optionId.split(',').sort().join(',')
          const correctSelections = correctOptionId?.split(',').sort().join(',') || ''
          
          answer.isCorrect = playerSelections === correctSelections
          const score = calculateScore(answer.isCorrect, answer.timeElapsed, timeLimit)
          answer.score = score
          const player = room.players.get(answer.playerId)
          if (player) player.score += score
        })

        io.to(sessionId).emit('question-end', {
          correctOptionId, // String com IDs corretos separados por vírgula
          questionIndex,
          questionType: 'multi_select',
        })

      } else {
        // Lógica para Resposta Única
        answers.forEach((answer) => {
          answer.isCorrect = answer.optionId === correctOptionId
          const score = calculateScore(answer.isCorrect, answer.timeElapsed, timeLimit)
          answer.score = score
          const player = room.players.get(answer.playerId)
          if (player) player.score += score
        })

        io.to(sessionId).emit('question-end', {
          correctOptionId,
          questionIndex,
          questionType: 'multiple_choice',
        })
      }


      room.currentQuestionId = null
      room.currentQuestionType = null
      room.currentCorrectNumericAnswer = null
    }
  )

  socket.on('host-end-game', (data: { sessionId: string }) => {
    const { sessionId } = data
    console.log(`[Host-End-Game] Session: ${sessionId}`)

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.error(`[Host-End-Game] Room not found: ${sessionId}`)
      return
    }

    room.status = 'finished'

    // Clear all timers
    room.questionTimers.forEach((timer) => clearTimeout(timer))
    room.questionTimers.clear()
    if (room.pendingQuestion?.timer) {
      clearTimeout(room.pendingQuestion.timer)
    }

    const leaderboard = getLeaderboard(room)

    // Broadcast game-end to all players in the session
    io.to(sessionId).emit('game-end', {
      leaderboard,
    })

    console.log(`[Host-End-Game] Game ended for session ${sessionId}. Leaderboard:`, leaderboard)
  })

  socket.on('host-kick-player', (data: { sessionId: string; playerId: string }) => {
    const { sessionId, playerId } = data
    console.log(`[Host-Kick-Player] Session: ${sessionId}, Player: ${playerId}`)

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.error(`[Host-Kick-Player] Room not found: ${sessionId}`)
      return
    }

    const player = room.players.get(playerId)
    if (player) {
      // Notify the kicked player
      io.to(player.socketId).emit('kicked', { message: 'You have been removed from the game.' })

      // Remove player from room
      room.players.delete(playerId)
      playerSessionMap.delete(playerId)
      socketToPlayer.delete(player.socketId)

      // Notify host that player left
      io.to(room.hostSocketId).emit('player-left', { playerId })

      // Make the player leave the socket room
      const playerSocket = io.sockets.sockets.get(player.socketId)
      if (playerSocket) {
        playerSocket.leave(sessionId)
      }

      // Check if this affects pending question readiness
      if (room.pendingQuestion && room.status === 'preparing') {
        room.pendingQuestion.readyPlayers.delete(playerId)
        const readyCount = room.pendingQuestion.readyPlayers.size
        const totalPlayers = room.players.size

        // Notify everyone of updated ready count
        io.to(sessionId).emit('players-ready-update', {
          readyCount,
          totalPlayers,
          readyPlayerIds: Array.from(room.pendingQuestion.readyPlayers),
        })

        // Check if all remaining players are now ready
        if (totalPlayers > 0 && readyCount >= totalPlayers) {
          console.log(`[Host-Kick-Player] All remaining players ready, launching question in session ${sessionId}`)
          launchQuestion(room)
        }
      }

      console.log(`[Host-Kick-Player] Player ${player.name} (${playerId}) kicked from session ${sessionId}`)
    }
  })

  // ─── Player Events ─────────────────────────────────────────────────────

  socket.on('player-join', (data: { pin: string; name: string }) => {
    const { pin, name } = data
    console.log(`[Player-Join] Name: ${name}, PIN: ${pin}, Socket: ${socket.id}`)

    const sessionId = pinToSession.get(pin)
    if (!sessionId) {
      console.warn(`[Player-Join] Invalid PIN: ${pin}`)
      socket.emit('join-error', { message: 'PIN inválido. Verifique e tente novamente.' })
      return
    }

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.warn(`[Player-Join] Room not found for PIN: ${pin}`)
      socket.emit('join-error', { message: 'Sessão do jogo não encontrada.' })
      return
    }

    if (room.status === 'finished') {
      console.warn(`[Player-Join] Game already finished: ${sessionId}`)
      socket.emit('join-error', { message: 'Este jogo já terminou.' })
      return
    }

    // Check for duplicate name - but allow reconnection from same/disconnected socket
    let existingPlayerId: string | null = null
    let isDuplicateName = false
    room.players.forEach((p) => {
      if (p.name.toLowerCase() === name.toLowerCase()) {
        // If the player's old socket is disconnected, allow reconnection
        const oldSocket = io.sockets.sockets.get(p.socketId)
        if (!oldSocket || !oldSocket.connected) {
          // Old socket is gone - this is a reconnection
          existingPlayerId = p.id
          console.log(`[Player-Join] Reconnection detected for "${name}" (${p.id})`)
        } else {
          isDuplicateName = true
        }
      }
    })

    // Handle reconnection: update socket info and re-join room
    if (existingPlayerId) {
      const player = room.players.get(existingPlayerId)!
      // Clean up old socket mapping
      socketToPlayer.delete(player.socketId)
      // Update to new socket
      player.socketId = socket.id
      socketToPlayer.set(socket.id, { playerId: existingPlayerId, sessionId })
      socket.join(sessionId)

      // Notify player of successful reconnection
      socket.emit('join-success', {
        sessionId,
        playerId: existingPlayerId,
        playerName: name,
      })

      // If room is in preparing state, send the current prepare info
      if (room.status === 'preparing' && room.pendingQuestion) {
        const isReady = room.pendingQuestion.readyPlayers.has(existingPlayerId)
        socket.emit('question-prepare', {
          questionIndex: room.pendingQuestion.questionIndex,
          questionType: room.pendingQuestion.question.type,
          timeLimit: room.pendingQuestion.question.timeLimit,
          totalPlayers: room.players.size,
          readyCount: room.pendingQuestion.readyPlayers.size,
          isReady,
        })
      }

      console.log(
        `[Player-Join] Player "${name}" reconnected to session ${sessionId}. Total players: ${room.players.size}`
      )
      return
    }

    if (isDuplicateName) {
      console.warn(`[Player-Join] Duplicate name "${name}" in session ${sessionId}`)
      socket.emit('join-error', { message: 'Este nome já está em uso. Escolha outro.' })
      return
    }

    const playerId = generateId()
    const playerInfo: PlayerInfo = {
      id: playerId,
      name,
      socketId: socket.id,
      score: 0,
    }

    room.players.set(playerId, playerInfo)
    playerSessionMap.set(playerId, sessionId)
    socketToPlayer.set(socket.id, { playerId, sessionId })
    socket.join(sessionId)

    // Notify host
    io.to(room.hostSocketId).emit('player-joined', {
      player: {
        id: playerId,
        name,
        score: 0,
      },
    })

    // Notify player of successful join
    socket.emit('join-success', {
      sessionId,
      playerId,
      playerName: name,
    })

    console.log(
      `[Player-Join] Player "${name}" (${playerId}) joined session ${sessionId}. Total players: ${room.players.size}`
    )
  })

  /**
   * Player signals they are ready for the upcoming question.
   * When all players are ready, the question is automatically launched.
   */
  socket.on('player-ready', (data: { sessionId: string }) => {
    const { sessionId } = data
    console.log(`[Player-Ready] Session: ${sessionId}, Socket: ${socket.id}`)

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.error(`[Player-Ready] Room not found: ${sessionId}`)
      return
    }

    if (room.status !== 'preparing' || !room.pendingQuestion) {
      console.warn(`[Player-Ready] Room is not in preparing state: ${sessionId}`)
      return
    }

    const socketInfo = socketToPlayer.get(socket.id)
    if (!socketInfo) {
      console.error(`[Player-Ready] Player not found for socket: ${socket.id}`)
      return
    }

    const { playerId } = socketInfo

    // Mark player as ready
    room.pendingQuestion.readyPlayers.add(playerId)

    const readyCount = room.pendingQuestion.readyPlayers.size
    const totalPlayers = room.players.size

    console.log(
      `[Player-Ready] Player ${playerId} is ready. ${readyCount}/${totalPlayers} players ready in session ${sessionId}`
    )

    // Notify everyone of the updated ready count
    io.to(sessionId).emit('players-ready-update', {
      readyCount,
      totalPlayers,
      readyPlayerIds: Array.from(room.pendingQuestion.readyPlayers),
    })

    // Check if all players are ready
    if (totalPlayers > 0 && readyCount >= totalPlayers) {
      console.log(`[Player-Ready] All players ready! Launching question in session ${sessionId}`)
      launchQuestion(room)
    }
  })

  socket.on(
    'player-answer',
    (data: {
      sessionId: string
      questionId: string
      optionId?: string
      optionIds?: string[]
      numericAnswer?: number
      timeElapsed: number
    }) => {
      const { sessionId, questionId, optionId, numericAnswer, timeElapsed } = data
      console.log(
        `[Player-Answer] Session: ${sessionId}, Q: ${questionId}, Option: ${optionId}, Numeric: ${numericAnswer}, Time: ${timeElapsed}`
      )

      const room = gameRooms.get(sessionId)
      if (!room) {
        console.error(`[Player-Answer] Room not found: ${sessionId}`)
        return
      }

      if (room.status !== 'active') {
        console.warn(`[Player-Answer] Room is not active: ${sessionId}`)
        return
      }

      const socketInfo = socketToPlayer.get(socket.id)
      if (!socketInfo) {
        console.error(`[Player-Answer] Player not found for socket: ${socket.id}`)
        return
      }

      const { playerId } = socketInfo

      // Check if player already answered this question
      const existingAnswers = room.answers.get(questionId) || []
      const alreadyAnswered = existingAnswers.some((a) => a.playerId === playerId)
      if (alreadyAnswered) {
        console.warn(`[Player-Answer] Player ${playerId} already answered question ${questionId}`)
        return
      }

      // Store the answer
      const answer: PlayerAnswer = {
        playerId,
        optionId: data.optionIds ? data.optionIds.join(',') : (data.optionId || ''),
        numericAnswer: numericAnswer !== undefined ? numericAnswer : null,
        timeElapsed,
        isCorrect: false, // Will be determined when host ends the question
        score: 0,
      }

      existingAnswers.push(answer)
      room.answers.set(questionId, existingAnswers)

      // Notify host that a player answered
      const player = room.players.get(playerId)
      if (room.currentQuestionType === 'numeric') {
        io.to(room.hostSocketId).emit('player-answered', {
          playerId,
          questionId,
          numericAnswer: numericAnswer ?? null,
          playerName: player?.name || 'Unknown',
        })
      } else {
        io.to(room.hostSocketId).emit('player-answered', {
          playerId,
          questionId,
          optionId: optionId || '',
        })
      }

      // Confirm receipt to player
      socket.emit('answer-received', {
        correct: null, // We don't reveal correctness yet
        score: 0, // Score will be calculated when question ends
      })

      console.log(
        `[Player-Answer] Player ${playerId} answered Q:${questionId}. Total answers: ${existingAnswers.length}/${room.players.size}`
      )

      // If all players have answered, notify host
      if (existingAnswers.length >= room.players.size) {
        console.log(`[Player-Answer] All players answered question ${questionId}`)
        io.to(room.hostSocketId).emit('all-players-answered', {
          sessionId,
          questionId,
          answerCount: existingAnswers.length,
          totalPlayers: room.players.size,
        })
      }
    }
  )

  socket.on('player-leave', (data: { sessionId: string; playerId: string }) => {
    const { sessionId, playerId } = data
    console.log(`[Player-Leave] Session: ${sessionId}, Player: ${playerId}`)

    const room = gameRooms.get(sessionId)
    if (!room) {
      console.error(`[Player-Leave] Room not found: ${sessionId}`)
      return
    }

    const player = room.players.get(playerId)
    if (player) {
      room.players.delete(playerId)
      playerSessionMap.delete(playerId)
      socketToPlayer.delete(player.socketId)
      socket.leave(sessionId)

      // Notify host
      io.to(room.hostSocketId).emit('player-left', { playerId })

      console.log(
        `[Player-Leave] Player "${player.name}" left session ${sessionId}. Remaining: ${room.players.size}`
      )
    }
  })

  // ─── Disconnect Handling ───────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    console.log(`[Disconnect] Socket disconnected: ${socket.id}, Reason: ${reason}`)

    // Check if this is a host
    const hostSessionId = socketToHost.get(socket.id)
    if (hostSessionId) {
      const room = gameRooms.get(hostSessionId)
      if (room) {
        console.log(`[Disconnect] Host disconnected from session ${hostSessionId}`)
        // Don't destroy the room immediately - host might reconnect
        // But notify players
        io.to(hostSessionId).emit('host-disconnected', {
          sessionId: hostSessionId,
          message: 'The host has disconnected. Waiting for reconnection...',
        })
      }
      socketToHost.delete(socket.id)
      return
    }

    // Check if this is a player
    const playerInfo = socketToPlayer.get(socket.id)
    if (playerInfo) {
      const { playerId, sessionId } = playerInfo
      const room = gameRooms.get(sessionId)
      if (room) {
        const player = room.players.get(playerId)
        if (player) {
          room.players.delete(playerId)
          playerSessionMap.delete(playerId)

          // Notify host
          io.to(room.hostSocketId).emit('player-left', { playerId })

          // Check if this affects pending question readiness
          if (room.status === 'preparing' && room.pendingQuestion) {
            room.pendingQuestion.readyPlayers.delete(playerId)
            const readyCount = room.pendingQuestion.readyPlayers.size
            const totalPlayers = room.players.size

            // Notify everyone of updated ready count
            io.to(sessionId).emit('players-ready-update', {
              readyCount,
              totalPlayers,
              readyPlayerIds: Array.from(room.pendingQuestion.readyPlayers),
            })

            // Check if all remaining players are now ready
            if (totalPlayers > 0 && readyCount >= totalPlayers) {
              console.log(`[Disconnect] All remaining players ready, launching question in session ${sessionId}`)
              launchQuestion(room)
            }
          }

          console.log(
            `[Disconnect] Player "${player.name}" disconnected from session ${sessionId}. Remaining: ${room.players.size}`
          )
        }
      }
      socketToPlayer.delete(socket.id)
    }
  })

  // ─── Error Handling ────────────────────────────────────────────────────

  socket.on('error', (error) => {
    console.error(`[Error] Socket error (${socket.id}):`, error)
  })
})

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = 3003

// Add error handlers to prevent crashes
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  console.error('[HTTP Server Error]', error.message)
  // Don't crash on transient errors
})

process.on('uncaughtException', (error: Error) => {
  console.error('[Uncaught Exception]', error.message)
  // Don't crash on uncaught exceptions
})

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Unhandled Rejection]', reason)
  // Don't crash on unhandled promise rejections
})

httpServer.listen(PORT, () => {
  console.log(`🎮 Quiz WebSocket service running on port ${PORT}`)
})

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`)

  // Clear all question timers
  gameRooms.forEach((room) => {
    room.questionTimers.forEach((timer) => clearTimeout(timer))
    if (room.pendingQuestion?.timer) {
      clearTimeout(room.pendingQuestion.timer)
    }
  })

  io.disconnectSockets(true)

  httpServer.close(() => {
    console.log('[Shutdown] Server closed')
    process.exit(0)
  })

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('[Shutdown] Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

// Only handle SIGINT (Ctrl+C) - ignore SIGTERM to stay alive in sandbox
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
// In sandbox environments, SIGTERM can be sent unexpectedly. Only shut down on double SIGTERM.
let sigtermCount = 0
process.on('SIGTERM', () => {
  sigtermCount++
  if (sigtermCount >= 2) {
    gracefulShutdown('SIGTERM')
  } else {
    console.log('[Shutdown] SIGTERM received but ignored (send twice to shut down)')
  }
})

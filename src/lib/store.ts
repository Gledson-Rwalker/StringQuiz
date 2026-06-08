import { create } from 'zustand'

export interface QuizOption {
  id?: string
  text: string
  isCorrect: boolean
  color: string
  order: number
}

export interface QuizQuestion {
  id?: string
  text: string
  type: 'multiple_choice' | 'numeric' | 'multi_select'
  correctNumericAnswer?: number | null
  timeLimit: number
  order: number
  options: QuizOption[]
}

export interface Quiz {
  id: string
  title: string
  description: string
  category: string
  createdAt: string
  _count?: { questions: number }
  questions?: QuizQuestion[]
}

export interface Player {
  id: string
  name: string
  score: number
}

export type AppView =
  | 'admin-login'
  | 'dashboard'
  | 'editor'
  | 'host-lobby'
  | 'host-game'
  | 'host-results'
  | 'player-join'
  | 'player-waiting'
  | 'player-ready'
  | 'player-game'
  | 'player-results'


export interface NumericAnswerResult {
  playerId: string
  numericAnswer: number
  distance: number
  score: number
  playerName: string
}

interface AppStore {
  view: AppView
  setView: (view: AppView) => void
  quizzes: Quiz[]
  setQuizzes: (quizzes: Quiz[]) => void
  fetchQuizzes: () => Promise<void>
  currentQuiz: Quiz | null
  setCurrentQuiz: (quiz: Quiz | null) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  gamePin: string | null
  setGamePin: (pin: string | null) => void
  players: Player[]
  setPlayers: (players: Player[]) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (index: number) => void
  answerCount: number
  setAnswerCount: (count: number) => void
  totalQuestions: number
  setTotalQuestions: (count: number) => void
  questionStartTime: number | null
  setQuestionStartTime: (time: number | null) => void
  readyCount: number
  setReadyCount: (count: number) => void
  readyPlayerIds: string[]
  setReadyPlayerIds: (ids: string[]) => void
  isPlayerReady: boolean
  setIsPlayerReady: (ready: boolean) => void
  isPreparingQuestion: boolean
  setIsPreparingQuestion: (preparing: boolean) => void
  playerId: string | null
  setPlayerId: (id: string | null) => void
  playerName: string | null
  setPlayerName: (name: string | null) => void
  playerScore: number
  setPlayerScore: (score: number) => void
  selectedOptionId: string | null
  setSelectedOptionId: (id: string | null) => void
  selectedOptionIds: string[]
  setSelectedOptionIds: (ids: string[]) => void
  lastAnswerCorrect: boolean | null
  setLastAnswerCorrect: (correct: boolean | null) => void
  currentQuestionId: string | null
  setCurrentQuestionId: (id: string | null) => void
  playerCurrentQuestion: {
    id: string
    text: string
    type: string
    timeLimit: number
    options: { id: string; text: string; color: string }[]
  } | null
  setPlayerCurrentQuestion: (q: AppStore['playerCurrentQuestion']) => void
  playerQuestionStartTime: number
  setPlayerQuestionStartTime: (t: number) => void
  playerNumericAnswer: number | null
  setPlayerNumericAnswer: (answer: number | null) => void
  numericAnswerResults: NumericAnswerResult[]
  setNumericAnswerResults: (results: NumericAnswerResult[]) => void
  leaderboard: { name: string; score: number }[]
  setLeaderboard: (lb: { name: string; score: number }[]) => void
  socket: ReturnType<typeof import('socket.io-client')['io']> | null
  setSocket: (socket: ReturnType<typeof import('socket.io-client')['io']> | null) => void
  answerDistribution: Record<string, number>
  setAnswerDistribution: (dist: Record<string, number>) => void
  hostNumericAnswers: { playerId: string; playerName: string; numericAnswer: number | null }[]
  addHostNumericAnswer: (entry: { playerId: string; playerName: string; numericAnswer: number | null }) => void
  clearHostNumericAnswers: () => void
  questionEnded: boolean
  setQuestionEnded: (ended: boolean) => void
  correctOptionId: string | null
  setCorrectOptionId: (id: string | null) => void
  correctNumericAnswer: number | null
  setCorrectNumericAnswer: (answer: number | null) => void
  isFetchingQuizzes: boolean
  setIsFetchingQuizzes: (val: boolean) => void
  isSaving: boolean
  setIsSaving: (val: boolean) => void
  reset: () => void
}

const initialState = {
  view: 'player-join' as AppView,
  quizzes: [],
  currentQuiz: null,
  sessionId: null,
  gamePin: null,
  players: [],
  currentQuestionIndex: 0,
  answerCount: 0,
  totalQuestions: 0,
  questionStartTime: null,
  readyCount: 0,
  readyPlayerIds: [],
  isPlayerReady: false,
  isPreparingQuestion: false,
  playerId: null,
  playerName: null,
  playerScore: 0,
  selectedOptionId: null,
  selectedOptionIds: [],
  lastAnswerCorrect: null,
  currentQuestionId: null,
  playerCurrentQuestion: null,
  playerQuestionStartTime: 0,
  playerNumericAnswer: null,
  numericAnswerResults: [],
  leaderboard: [],
  socket: null,
  answerDistribution: {},
  hostNumericAnswers: [],
  questionEnded: false,
  correctOptionId: null,
  correctNumericAnswer: null,
  isFetchingQuizzes: false,
  isSaving: false,
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  setView: (view) => set({ view }),
  setQuizzes: (quizzes) => set({ quizzes }),
  fetchQuizzes: async () => {
    set({ isFetchingQuizzes: true })
    try {
      const res = await fetch('/api/quizzes')
      if (res.ok) {
        const data = await res.json()
        set({ quizzes: data.quizzes || [] })
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err)
    } finally {
      set({ isFetchingQuizzes: false })
    }
  },
  setCurrentQuiz: (quiz) => set({ currentQuiz: quiz }),
  setSessionId: (id) => set({ sessionId: id }),
  setGamePin: (pin) => set({ gamePin: pin }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) =>
    set((state) => ({ players: [...state.players, player] })),
  removePlayer: (playerId) =>
    set((state) => ({ players: state.players.filter((p) => p.id !== playerId) })),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  setAnswerCount: (count) => set({ answerCount: count }),
  setTotalQuestions: (count) => set({ totalQuestions: count }),
  setQuestionStartTime: (time) => set({ questionStartTime: time }),
  setReadyCount: (count) => set({ readyCount: count }),
  setReadyPlayerIds: (ids) => set({ readyPlayerIds: ids }),
  setIsPlayerReady: (ready) => set({ isPlayerReady: ready }),
  setIsPreparingQuestion: (preparing) => set({ isPreparingQuestion: preparing }),
  setPlayerId: (id) => set({ playerId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerScore: (score) => set({ playerScore: score }),
  setSelectedOptionId: (id) => set({ selectedOptionId: id }),
  setSelectedOptionIds: (ids) => set({ selectedOptionIds: ids }),
  setLastAnswerCorrect: (correct) => set({ lastAnswerCorrect: correct }),
  setCurrentQuestionId: (id) => set({ currentQuestionId: id }),
  setPlayerCurrentQuestion: (q) => set({ playerCurrentQuestion: q }),
  setPlayerQuestionStartTime: (t) => set({ playerQuestionStartTime: t }),
  setPlayerNumericAnswer: (answer) => set({ playerNumericAnswer: answer }),
  setNumericAnswerResults: (results) => set({ numericAnswerResults: results }),
  setLeaderboard: (lb) => set({ leaderboard: lb }),
  setSocket: (socket) => set({ socket }),
  setAnswerDistribution: (dist) => set({ answerDistribution: dist }),
  addHostNumericAnswer: (entry) =>
    set((state) => ({ hostNumericAnswers: [...state.hostNumericAnswers, entry] })),
  clearHostNumericAnswers: () => set({ hostNumericAnswers: [] }),
  setQuestionEnded: (ended) => set({ questionEnded: ended }),
  setCorrectOptionId: (id) => set({ correctOptionId: id }),
  setCorrectNumericAnswer: (answer) => set({ correctNumericAnswer: answer }),
  setIsFetchingQuizzes: (val) => set({ isFetchingQuizzes: val }),
  setIsSaving: (val) => set({ isSaving: val }),
  reset: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
    }
    set({ ...initialState, quizzes: get().quizzes })
  },
}))
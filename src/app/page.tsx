'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus, Play, Edit3, Trash2, Users, Trophy, ArrowLeft,
  Clock, ChevronUp, ChevronDown, X, Check, Loader2,
  Hash, Zap, Brain, Tag, Database, UserPlus, LogOut,
  RotateCcw, Crown, Medal, Award, CircleDot, Timer,
  ArrowRight, Send, Sparkles, Gamepad2, Hash as HashIcon,
  Calculator, Target, TrendingUp, ThumbsUp, Hand, Lock
} from 'lucide-react'

import { useAppStore, Quiz, QuizQuestion, QuizOption, Player, NumericAnswerResult } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'] as const
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const
const OPTION_COLOR_NAMES = ['red', 'blue', 'yellow', 'green'] as const

// ─── Animation Variants ──────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
}

const slideInVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function createEmptyQuestion(order: number, type: 'multiple_choice' | 'numeric' = 'multiple_choice'): QuizQuestion {
  return {
    text: '',
    type,
    timeLimit: 20,
    order,
    ...(type === 'multiple_choice' ? {
      options: OPTION_COLOR_NAMES.map((color, i) => ({
        text: '',
        isCorrect: i === 0,
        color,
        order: i,
      })),
    } : {
      options: [],
      correctNumericAnswer: null,
    }),
  }
}

function connectSocket(): Socket {
  // Connect to same origin - the /api/socket.io route proxies to WS service
  const socket = io({
    path: '/api/socket.io',
    transports: ['polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message)
  })

  return socket
}

function AdminLoginView() {
  const { setView } = useAppStore()
  const [password, setPassword] = useState('')

  const handleLogin = () => {
    // Você pode mudar essa senha para a que preferir
    if (password === 'admin123') { 
      setView('dashboard')
    } else {
      toast.error('Senha incorreta')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E293B] text-white px-4">
      <Card className="w-full max-w-sm bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
            <Lock className="size-5 text-emerald-400" />
            Acesso Restrito
          </CardTitle>
          <CardDescription className="text-slate-400">Área exclusiva para organizadores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="bg-slate-900 border-slate-600 text-white text-center text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg" onClick={handleLogin}>
            Entrar no Painel
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setView('player-join')}>
            Voltar para o Jogo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView() {
  const {
    quizzes, fetchQuizzes, setView, setCurrentQuiz,
    isFetchingQuizzes, setIsFetchingQuizzes,
  } = useAppStore()
  const [seeding, setSeeding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizzes()
  }, [fetchQuizzes])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed')
      if (res.ok) {
        toast.success('Dados de exemplo carregados com sucesso!')
        await fetchQuizzes()
      } else {
        toast.error('Erro ao carregar dados de exemplo')
      }
    } catch {
      toast.error('Erro ao carregar dados de exemplo')
    } finally {
      setSeeding(false)
    }
  }

  const handleCreateQuiz = async () => {
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Novo Quiz', description: '', category: 'Geral' }),
      })
      if (res.ok) {
        const data = await res.json()
        const quiz = data.quiz
        setCurrentQuiz({
          ...quiz,
          questions: [createEmptyQuestion(0)],
        })
        setView('editor')
      } else {
        toast.error('Erro ao criar quiz')
      }
    } catch {
      toast.error('Erro ao criar quiz')
    }
  }

  const handleEdit = async (quiz: Quiz) => {
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`)
      if (res.ok) {
        const data = await res.json()
        const fullQuiz = data.quiz
        const questions: QuizQuestion[] = fullQuiz.questions?.length > 0
          ? fullQuiz.questions.map((q: any) => ({
              id: q.id,
              text: q.text,
              type: q.type || 'multiple_choice',
              correctNumericAnswer: q.correctNumericAnswer ?? null,
              timeLimit: q.timeLimit,
              order: q.order,
              // O SEGREDO ESTÁ AQUI: Aceitar opções tanto para multiple_choice quanto para multi_select
              options: (q.type === 'multiple_choice' || q.type === 'multi_select') && q.options 
                ? q.options.map((o: any) => ({
                    id: o.id,
                    text: o.text,
                    isCorrect: o.isCorrect,
                    color: o.color,
                    order: o.order,
                  })) 
                : [],
            }))
          : [createEmptyQuestion(0)]
        setCurrentQuiz({ ...fullQuiz, questions })
        setView('editor')
      }
    } catch {
      toast.error('Erro ao carregar quiz')
    }
  }

  const handleStart = async (quiz: Quiz) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id }),
      })
      if (res.ok) {
        const data = await res.json()
        const session = data.session
        const store = useAppStore.getState()
        store.setSessionId(session.id)
        store.setGamePin(null)
        store.setPlayers([])
        store.setAnswerCount(0)
        store.setCurrentQuestionIndex(0)
        store.setQuestionEnded(false)
        store.setCorrectOptionId(null)
        store.setAnswerDistribution({})
        store.setTotalQuestions(quiz._count?.questions || 0)
        store.setCurrentQuiz(quiz as any)
        store.setReadyCount(0)
        store.setReadyPlayerIds([])
        store.setIsPreparingQuestion(false)
        setView('host-lobby')
      } else {
        toast.error('Erro ao criar sessão')
      }
    } catch {
      toast.error('Erro ao criar sessão')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Quiz excluído com sucesso')
        await fetchQuizzes()
      } else {
        toast.error('Erro ao excluir quiz')
      }
    } catch {
      toast.error('Erro ao excluir quiz')
    } finally {
      setDeleteId(null)
    }
  }

  const totalQuestions = quizzes.reduce((acc, q) => acc + (q._count?.questions || 0), 0)
  const categories = [...new Set(quizzes.map((q) => q.category))]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <img src="/logo.png" alt="StringQuiz Logo" className="h-14 w-auto object-contain" />
              <p className="text-slate-300 mt-1 text-sm sm:text-base">Seu quiz interativo junto com a sua turma</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateQuiz} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="size-4" />
                Criar Novo Quiz
              </Button>
              <Button
                variant="outline"
                onClick={() => setView('player-join')}
                className="border-slate-500 text-white hover:bg-slate-700"
              >
                <LogOut className="size-4 mr-2" />
                Sair do Painel
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div {...cardVariants}>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Quizzes</p>
                    <p className="text-2xl font-bold">{quizzes.length}</p>
                  </div>
                  <Database className="size-8 text-emerald-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div {...cardVariants} transition={{ delay: 0.05 }}>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Quizzes Ativos</p>
                    <p className="text-2xl font-bold">{quizzes.length}</p>
                  </div>
                  <Zap className="size-8 text-blue-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div {...cardVariants} transition={{ delay: 0.1 }}>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Perguntas</p>
                    <p className="text-2xl font-bold">{totalQuestions}</p>
                  </div>
                  <CircleDot className="size-8 text-amber-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div {...cardVariants} transition={{ delay: 0.15 }}>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Categorias</p>
                    <p className="text-2xl font-bold">{categories.length}</p>
                  </div>
                  <Tag className="size-8 text-purple-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quiz Grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1E293B]">Meus Quizzes</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            Carregar Dados de Exemplo
          </Button>
        </div>

        {quizzes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Brain className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum quiz encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro quiz ou carregue dados de exemplo para começar.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCreateQuiz} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="size-4" />
                  Criar Novo Quiz
                </Button>
                <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                  <Database className="size-4" />
                  Carregar Exemplos
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz, index) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{quiz.title}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {quiz.description || 'Sem descrição'}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {quiz.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CircleDot className="size-3.5" />
                        {quiz._count?.questions || 0} perguntas
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formatDate(quiz.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2 pt-0">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleStart(quiz)}
                    >
                      <Play className="size-3.5" />
                      Iniciar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEdit(quiz)}
                    >
                      <Edit3 className="size-3.5" />
                      Editar
                    </Button>
                    <AlertDialog open={deleteId === quiz.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="shrink-0"
                          onClick={() => setDeleteId(quiz.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Quiz</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o quiz &quot;{quiz.title}&quot;? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(quiz.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1E293B] text-slate-400 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          StringQuiz &copy; {new Date().getFullYear()} — Criado por Gledson Rwalker
        </div>
      </footer>
    </div>
  )
}

// ─── Quiz Editor View ─────────────────────────────────────────────────────────

function EditorView() {
  const { currentQuiz, setCurrentQuiz, setView, fetchQuizzes, isSaving, setIsSaving } = useAppStore()
  const [quizTitle, setQuizTitle] = useState(currentQuiz?.title || '')
  const [quizDesc, setQuizDesc] = useState(currentQuiz?.description || '')
  const [quizCategory, setQuizCategory] = useState(currentQuiz?.category || '')
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    currentQuiz?.questions || [createEmptyQuestion(0)]
  )

  const quizId = currentQuiz?.id

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion(questions.length)])
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('O quiz deve ter pelo menos uma pergunta')
      return
    }
    const newQuestions = questions.filter((_, i) => i !== index)
    newQuestions.forEach((q, i) => (q.order = i))
    setQuestions([...newQuestions])
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[newIndex]
    newQuestions[newIndex] = temp
    newQuestions.forEach((q, i) => (q.order = i))
    setQuestions(newQuestions)
  }

  const updateQuestionText = (index: number, text: string) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], text }
    setQuestions(newQuestions)
  }

  const updateQuestionTimeLimit = (index: number, timeLimit: number) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], timeLimit }
    setQuestions(newQuestions)
  }

  const updateQuestionType = (index: number, type: 'multiple_choice' | 'numeric' | 'multi_select') => {
    const newQuestions = [...questions]
    const currentQuestion = newQuestions[index]

    if (type === 'numeric') {
      newQuestions[index] = { ...currentQuestion, type, options: [], correctNumericAnswer: null }
    } else {
      // Se já tinha opções, mantém. Se não (veio de numérica), cria as 4 padrão.
      const existingOptions = currentQuestion.options.length > 0 ? currentQuestion.options : OPTION_COLOR_NAMES.map((color, i) => ({
        text: '',
        isCorrect: i === 0,
        color,
        order: i,
      }))

      newQuestions[index] = {
        ...currentQuestion,
        type,
        options: existingOptions,
        correctNumericAnswer: undefined,
      }
    }
    setQuestions(newQuestions)
  }

  const updateCorrectNumericAnswer = (index: number, value: number | null) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], correctNumericAnswer: value }
    setQuestions(newQuestions)
  }

  const updateOptionText = (qIndex: number, oIndex: number, text: string) => {
    const newQuestions = [...questions]
    const newOptions = [...newQuestions[qIndex].options]
    newOptions[oIndex] = { ...newOptions[oIndex], text }
    newQuestions[qIndex] = { ...newQuestions[qIndex], options: newOptions }
    setQuestions(newQuestions)
  }

  const setCorrectOption = (qIndex: number, oIndex: number) => {
    const newQuestions = [...questions]
    const question = newQuestions[qIndex]

    if (question.type === 'multi_select') {
      // No modo Múltipla Seleção, ele inverte (toggle) a opção clicada sem mexer nas outras
      question.options[oIndex].isCorrect = !question.options[oIndex].isCorrect
    } else {
      // No modo Resposta Única, ele marca a clicada e desmarca todas as outras
      question.options = question.options.map((o, i) => ({
        ...o,
        isCorrect: i === oIndex,
      }))
    }
    setQuestions(newQuestions)
  }

  const handleSave = async () => {
    if (!quizTitle.trim()) {
      toast.error('O título do quiz é obrigatório')
      return
    }

    const hasEmptyQuestion = questions.some((q) => !q.text.trim())
    if (hasEmptyQuestion) {
      toast.error('Todas as perguntas devem ter texto')
      return
    }

    // Filtra perguntas que possuem opções (Única ou Múltipla Seleção)
    const optionQuestions = questions.filter((q) => q.type === 'multiple_choice' || q.type === 'multi_select')
    
    const hasEmptyOption = optionQuestions.some((q) => q.options.some((o) => !o.text.trim()))
    if (hasEmptyOption) {
      toast.error('Todas as opções devem ter texto')
      return
    }

    const hasNoCorrect = optionQuestions.some((q) => !q.options.some((o) => o.isCorrect))
    if (hasNoCorrect) {
      toast.error('Cada pergunta de múltipla escolha ou seleção deve ter pelo menos uma opção correta')
      return
    }

    const numQuestions = questions.filter((q) => q.type === 'numeric')
    const hasNoNumericAnswer = numQuestions.some((q) => q.correctNumericAnswer === null || q.correctNumericAnswer === undefined)
    if (hasNoNumericAnswer) {
      toast.error('Cada pergunta numérica deve ter uma resposta correta')
      return
    }

    setIsSaving(true)
    try {
      await fetch(`/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: quizTitle, description: quizDesc, category: quizCategory }),
      })

      const questionsPayload = questions.map((q, idx) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        correctNumericAnswer: q.type === 'numeric' ? q.correctNumericAnswer : null,
        timeLimit: q.timeLimit,
        order: idx,
        options: (q.type === 'multiple_choice' || q.type === 'multi_select') ? q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          color: o.color,
          order: o.order,
        })) : [],
      }))

      const res = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: questionsPayload }),
      })

      if (res.ok) {
        toast.success('Quiz salvo com sucesso!')
        await fetchQuizzes()
        setView('dashboard')
      } else {
        toast.error('Erro ao salvar questões')
      }
    } catch {
      toast.error('Erro ao salvar quiz')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-[#1E293B] text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-700"
            onClick={() => setView('dashboard')}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Editor de Quiz</h1>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar Quiz
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full">
        {/* Quiz Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Informações do Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Título</label>
              <Input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Título do quiz"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea
                value={quizDesc}
                onChange={(e) => setQuizDesc(e.target.value)}
                placeholder="Descrição do quiz"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Input
                value={quizCategory}
                onChange={(e) => setQuizCategory(e.target.value)}
                placeholder="Ex: Cultura, Segurança, Compliance"
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <motion.div
              key={qIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: qIndex * 0.03 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`rounded-full w-7 h-7 flex items-center justify-center text-sm ${
                        question.type === 'numeric' ? 'bg-amber-500 text-white' : 'bg-[#1E293B] text-white'
                      }`}>
                        {qIndex + 1}
                      </span>
                      Pergunta {qIndex + 1}
                      {question.type === 'numeric' && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                          <Calculator className="size-3 mr-1" />
                          Numérica
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => moveQuestion(qIndex, 'up')}
                        disabled={qIndex === 0}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => moveQuestion(qIndex, 'down')}
                        disabled={qIndex === questions.length - 1}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => removeQuestion(qIndex)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Input
                      value={question.text}
                      onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                      placeholder="Digite a pergunta..."
                    />
                  </div>

                  {/* Question Type Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">Tipo:</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => updateQuestionType(qIndex, 'multiple_choice')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${question.type === 'multiple_choice' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <CircleDot className="size-3.5" /> Resposta Única
                      </button>
                      <button
                        onClick={() => updateQuestionType(qIndex, 'multi_select')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${question.type === 'multi_select' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <Check className="size-3.5" /> Múltipla Seleção
                      </button>
                      <button
                        onClick={() => updateQuestionType(qIndex, 'numeric')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${question.type === 'numeric' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <Calculator className="size-3.5" /> Numérica
                      </button>
                    </div>
                  </div>

                  {question.type === 'numeric' ? (
                    /* Numeric Answer Input */
                    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="size-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">
                          Pergunta Numérica
                        </span>
                      </div>
                      <p className="text-xs text-amber-600 mb-3">
                        Os jogadores digitarão um número. Quanto mais perto da resposta correta, mais pontos ganham! Bônus de velocidade também é aplicado.
                      </p>
                      <div>
                        <label className="text-sm font-medium mb-1 block text-amber-700">
                          Resposta Correta (número)
                        </label>
                        <Input
                          type="number"
                          step="any"
                          value={question.correctNumericAnswer !== null && question.correctNumericAnswer !== undefined ? question.correctNumericAnswer : ''}
                          onChange={(e) => {
                            const val = e.target.value
                            updateCorrectNumericAnswer(qIndex, val === '' ? null : parseFloat(val))
                          }}
                          placeholder="Ex: 1500, 3.14, -10..."
                          className="text-lg font-mono bg-white border-amber-300 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Multiple Choice Options */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {question.options.map((option, oIndex) => (
                        <div
                          key={oIndex}
                          className={`rounded-lg border-2 p-3 transition-all ${
                            option.isCorrect
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-transparent bg-slate-50'
                          }`}
                          style={{ borderLeftWidth: '4px', borderLeftColor: OPTION_COLORS[oIndex] }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0"
                              style={{ backgroundColor: OPTION_COLORS[oIndex] }}
                            >
                              {OPTION_LABELS[oIndex]}
                            </span>
                            <button
                              onClick={() => setCorrectOption(qIndex, oIndex)}
                              className={`ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                                option.isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {question.type === 'multi_select' ? (
                                <>
                                  {option.isCorrect ? <Check className="size-3" /> : <Plus className="size-3" />}
                                  {option.isCorrect ? 'Selecionada' : 'Adicionar'}
                                </>
                              ) : (
                                <>
                                  <Check className="size-3" />
                                  {option.isCorrect ? 'Correta' : 'Marcar'}
                                </>
                              )}
                            </button>
                          </div>
                          <Input
                            value={option.text}
                            onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                            placeholder={`Opção ${OPTION_LABELS[oIndex]}`}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium shrink-0">Tempo limite:</label>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={question.timeLimit}
                      onChange={(e) => updateQuestionTimeLimit(qIndex, parseInt(e.target.value))}
                      className="flex-1 accent-emerald-600"
                    />
                    <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded w-14 text-center">
                      {question.timeLimit}s
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Add Question Button */}
        <div className="mt-6 mb-8">
          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-12"
            onClick={addQuestion}
          >
            <Plus className="size-4" />
            Adicionar Pergunta
          </Button>
        </div>
      </main>

      <footer className="bg-[#1E293B] text-slate-400 py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-sm">
          StringQuiz &copy; {new Date().getFullYear()} — Criado por Gledson Rwalker
        </div>
      </footer>
    </div>
  )
}

// ─── Host Lobby View ──────────────────────────────────────────────────────────

function HostLobbyView() {
  const {
    sessionId, gamePin, setGamePin, players, addPlayer, removePlayer,
    setView, setSocket, currentQuiz,
  } = useAppStore()
  const isConnected = useAppStore().socket?.connected ?? false

  useEffect(() => {
    if (!sessionId) return

    // Only create a new socket if we don't have one already
    const existingSocket = useAppStore.getState().socket
    if (existingSocket?.connected) {
      const socket = existingSocket

      socket.on('session-created', (data: { pin: string }) => {
        setGamePin(data.pin)
      })

      socket.on('player-joined', (data: { player: Player }) => {
        addPlayer(data.player)
      })

      socket.on('player-left', (data: { playerId: string }) => {
        removePlayer(data.playerId)
      })

      return () => {
        socket.off('session-created')
        socket.off('player-joined')
        socket.off('player-left')
      }
    }

    const socket = connectSocket()
    setSocket(socket)

    socket.on('connect', () => {
      socket.emit('host-create', { sessionId })
    })

    socket.on('session-created', (data: { pin: string }) => {
      setGamePin(data.pin)
    })

    socket.on('player-joined', (data: { player: Player }) => {
      addPlayer(data.player)
    })

    socket.on('player-left', (data: { playerId: string }) => {
      removePlayer(data.playerId)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('session-created')
      socket.off('player-joined')
      socket.off('player-left')
    }
  }, [sessionId, setGamePin, addPlayer, removePlayer, setSocket])

  const handleStartGame = async () => {
    if (players.length === 0) return

    const store = useAppStore.getState()

    // Fetch full quiz with questions
    try {
      const res = await fetch(`/api/quizzes/${currentQuiz?.id}`)
      if (res.ok) {
        const data = await res.json()
        const fullQuiz = data.quiz
        store.setTotalQuestions(fullQuiz.questions?.length || 0)
        store.setCurrentQuiz({
          ...fullQuiz,
          questions: fullQuiz.questions?.map((q: any) => ({
            id: q.id,
            text: q.text,
            type: q.type || 'multiple_choice',
            correctNumericAnswer: q.correctNumericAnswer ?? null,
            timeLimit: q.timeLimit,
            order: q.order,
            options: q.options?.map((o: any) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect,
              color: o.color,
              order: o.order,
            })) || [],
          })),
        })
        store.setCurrentQuestionIndex(0)
        store.setAnswerCount(0)
        store.setQuestionEnded(false)
        store.setCorrectOptionId(null)
        store.setAnswerDistribution({})
        store.setReadyCount(0)
        store.setReadyPlayerIds([])
        store.setIsPreparingQuestion(false)
        setView('host-game')
      }
    } catch {
      toast.error('Erro ao carregar quiz')
    }
  }

  const pinDigits = gamePin ? gamePin.split('') : ['-', '-', '-', '-', '-', '-']

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      <header className="px-4 sm:px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-slate-700"
          onClick={() => {
            useAppStore.getState().socket?.disconnect()
            useAppStore.getState().setSocket(null)
            setView('dashboard')
          }}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-semibold">Sala de Espera</h1>
        <div className={`ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          {isConnected ? 'Conectado' : 'Conectando...'}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Quiz Title */}
        <p className="text-slate-300 text-sm mb-2">Quiz:</p>
        <h2 className="text-xl sm:text-2xl font-bold mb-8 text-center">
          {currentQuiz?.title || 'Carregando...'}
        </h2>

        {/* PIN Display */}
        <div className="mb-8">
          <p className="text-center text-slate-300 text-sm mb-4">Código do Jogo</p>
          <div className="flex justify-center">
            {pinDigits.map((digit, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring' }}
                className="pin-digit"
              >
                {digit}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Player Count */}
        <div className="flex items-center gap-2 text-emerald-400 mb-6">
          <Users className="size-5" />
          <span className="text-lg font-semibold">{players.length} jogador{players.length !== 1 ? 'es' : ''}</span>
        </div>

        {/* Player List */}
        <div className="w-full max-w-md mb-8">
          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
            <AnimatePresence>
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="bg-slate-700/50 rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{player.name}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {players.length === 0 && (
              <p className="text-center text-slate-400 py-4">
                Aguardando jogadores...
              </p>
            )}
          </div>
        </div>

        {/* Start Game Button */}
        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 py-6 h-auto"
          onClick={handleStartGame}
          disabled={players.length === 0}
        >
          <Play className="size-5" />
          Iniciar Jogo
        </Button>
        {players.length === 0 && (
          <p className="text-slate-400 text-sm mt-2">
            Aguarde pelo menos um jogador para iniciar
          </p>
        )}
      </main>

      <footer className="py-4 text-center text-slate-500 text-sm">
        QuizCorp &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}

// ─── Circular Timer Component ─────────────────────────────────────────────────

function CircularTimer({ timeLimit, startTime }: { timeLimit: number; startTime: number }) {
  const remainingRef = useRef(timeLimit)
  const [remaining, setRemaining] = useState(timeLimit)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    remainingRef.current = timeLimit
    const updateTimer = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const newRemaining = Math.max(0, timeLimit - elapsed)
      remainingRef.current = newRemaining
      setRemaining(newRemaining)
      if (newRemaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    intervalRef.current = setInterval(updateTimer, 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timeLimit, startTime])

  const percentage = (remaining / timeLimit) * 100
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (percentage / 100) * circumference

  const color =
    remaining > timeLimit * 0.5
      ? '#10B981'
      : remaining > timeLimit * 0.25
        ? '#D89E00'
        : '#E21B3C'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r="45" fill="none" stroke="#334155" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-100"
        />
      </svg>
      <span className="absolute text-2xl font-bold tabular-nums" style={{ color }}>
        {Math.ceil(remaining)}
      </span>
    </div>
  )
}

// ─── Host Game View ───────────────────────────────────────────────────────────

function HostGameView() {
  const {
    sessionId, currentQuiz, players, socket,
    currentQuestionIndex, setCurrentQuestionIndex,
    answerCount, setAnswerCount,
    totalQuestions, setView,
    questionEnded, setQuestionEnded,
    correctOptionId, setCorrectOptionId,
    answerDistribution, setAnswerDistribution,
    setQuestionStartTime, questionStartTime,
    numericAnswerResults, setNumericAnswerResults,
    hostNumericAnswers, addHostNumericAnswer, clearHostNumericAnswers,
    correctNumericAnswer, setCorrectNumericAnswer,
    readyCount, setReadyCount,
    readyPlayerIds, setReadyPlayerIds,
    isPreparingQuestion, setIsPreparingQuestion,
  } = useAppStore()

  const [showingResults, setShowingResults] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)

  const questions = currentQuiz?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  const endQuestion = useCallback(() => {
    if (useAppStore.getState().questionEnded) return
    setQuestionEnded(true)
    setShowingResults(true)

    const questionType = currentQuestion?.type || 'multiple_choice'

    if (questionType === 'numeric') {
      const correctAnswer = currentQuestion?.correctNumericAnswer
      if (correctAnswer !== null && correctAnswer !== undefined && socket) {
        socket.emit('host-end-question', {
          sessionId,
          correctNumericAnswer: correctAnswer,
          questionIndex: currentQuestionIndex,
        })
        setCorrectNumericAnswer(correctAnswer)
      }
    } else {
          const correctOpt = currentQuestion?.options.find((o) => o.isCorrect)
          if (correctOpt && socket) {
            socket.emit('host-end-question', {
              sessionId,
              correctOptionId: correctOpt.id,
              questionIndex: currentQuestionIndex,
            })
            setCorrectOptionId(correctOpt.id ?? null)
          }
        }
  }, [currentQuestion, socket, sessionId, currentQuestionIndex, setQuestionEnded, setCorrectOptionId, setCorrectNumericAnswer])

  // Socket listeners for host game events
  useEffect(() => {
    if (!socket) return

    const handlePlayerAnswered = (data: { optionId?: string; numericAnswer?: number | null; playerName?: string; playerId?: string }) => {
      setAnswerCount(useAppStore.getState().answerCount + 1)

      if (data.numericAnswer !== undefined && data.numericAnswer !== null) {
        addHostNumericAnswer({
          playerId: data.playerId || '',
          playerName: data.playerName || 'Unknown',
          numericAnswer: data.numericAnswer,
        })
      } else if (data.optionId) {
        const currentDist = useAppStore.getState().answerDistribution
        setAnswerDistribution({
          ...currentDist,
          [data.optionId]: (currentDist[data.optionId] || 0) + 1,
        })
      }
    }

    const handleQuestionEnd = (data: {
      correctOptionId?: string
      correctNumericAnswer?: number
      questionType?: string
      answerResults?: NumericAnswerResult[]
    }) => {
      if (data.questionType === 'numeric' && data.answerResults) {
        setNumericAnswerResults(data.answerResults)
      }
    }

    const handleTimeUp = () => {
      if (!useAppStore.getState().questionEnded) {
        endQuestion()
      }
    }

    const handlePlayersReadyUpdate = (data: { readyCount: number; totalPlayers: number; readyPlayerIds: string[] }) => {
      setReadyCount(data.readyCount)
      setReadyPlayerIds(data.readyPlayerIds)
    }

    const handleQuestionPrepare = (data: { questionIndex: number; questionType: string; timeLimit: number; totalPlayers: number; readyCount: number }) => {
      setIsPreparingQuestion(true)
      setReadyCount(data.readyCount)
    }

    const handleQuestionStart = () => {
      // When question actually starts (after all players ready), update state
      // IMPORTANT: set questionStartTime HERE to avoid race condition with separate useEffect
      setIsPreparingQuestion(false)
      setQuestionStartTime(Date.now())
      setReadyCount(0)
      setReadyPlayerIds([])
    }

    socket.on('player-answered', handlePlayerAnswered)
    socket.on('question-time-up', handleTimeUp)
    socket.on('question-end', handleQuestionEnd)
    socket.on('players-ready-update', handlePlayersReadyUpdate)
    socket.on('question-prepare', handleQuestionPrepare)
    socket.on('question-start', handleQuestionStart)

    return () => {
      socket.off('player-answered', handlePlayerAnswered)
      socket.off('question-time-up', handleTimeUp)
      socket.off('question-end', handleQuestionEnd)
      socket.off('players-ready-update', handlePlayersReadyUpdate)
      socket.off('question-prepare', handleQuestionPrepare)
      socket.off('question-start', handleQuestionStart)
    }
  }, [socket, setAnswerCount, addHostNumericAnswer, setAnswerDistribution, setNumericAnswerResults, setReadyCount, setReadyPlayerIds, setIsPreparingQuestion, setQuestionStartTime, endQuestion])

  // Send question prepare to get players ready
  const sendQuestion = useCallback(() => {
    const store = useAppStore.getState()
    const currentSocket = store.socket
    const currentQ = store.currentQuiz?.questions?.[store.currentQuestionIndex]
    const currentSId = store.sessionId
    if (!currentSocket || !currentQ || !currentSId) return

    // Reset state for new question
    store.setAnswerCount(0)
    store.setQuestionEnded(false)
    store.setCorrectOptionId(null)
    store.setAnswerDistribution({})
    store.setNumericAnswerResults([])
    store.clearHostNumericAnswers()
    store.setCorrectNumericAnswer(null)
    store.setReadyCount(0)
    store.setReadyPlayerIds([])

    // Emit prepare question — players will see "PRONTO!" button
    currentSocket.emit('host-prepare-question', {
      sessionId: currentSId,
      questionIndex: store.currentQuestionIndex,
      question: {
        id: currentQ.id,
        text: currentQ.text,
        type: currentQ.type || 'multiple_choice',
        timeLimit: currentQ.timeLimit,
        correctNumericAnswer: currentQ.correctNumericAnswer ?? null,
        options: currentQ.type === 'numeric' ? [] : currentQ.options.map((o) => ({
          id: o.id,
          text: o.text,
          color: o.color,
        })),
      },
    })

    store.setIsPreparingQuestion(true)
    setShowingResults(false)
  }, [])

  const forceStart = useCallback(() => {
    if (!socket || !sessionId) return
    socket.emit('host-force-start', { sessionId })
  }, [socket, sessionId])

  const nextQuestion = () => {
    if (currentQuestionIndex >= totalQuestions - 1) {
      // End game
      if (socket) {
        socket.emit('host-end-game', { sessionId })
      }
      setGameEnded(true)
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setAnswerCount(0)
      setAnswerDistribution({})
      setShowingResults(false)
      setQuestionEnded(false)
      setCorrectOptionId(null)
      setCorrectNumericAnswer(null)
      setNumericAnswerResults([])
      clearHostNumericAnswers()
      setReadyCount(0)
      setReadyPlayerIds([])
      setIsPreparingQuestion(false)
      setQuestionStartTime(null)
    }
  }

  const goToResults = () => {
    setView('host-results')
  }

  if (gameEnded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E293B] text-white p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <Trophy className="size-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Jogo Finalizado!</h2>
          <p className="text-slate-300 mb-8">Todas as perguntas foram respondidas</p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={goToResults}
          >
            <Trophy className="size-5" />
            Ver Resultado Final
          </Button>
        </motion.div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1E293B] text-white">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      {/* Top bar */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">
            Pergunta {currentQuestionIndex + 1} de {totalQuestions}
          </span>
          <Badge variant="secondary" className="bg-slate-700 text-slate-200">
            <Users className="size-3 mr-1" />
            {players.length} jogadores
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300">
            {answerCount} de {players.length} responderam
          </span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-4xl mx-auto w-full">
        {/* PREPARING STATE - Waiting for players to click PRONTO! */}
        {isPreparingQuestion && !showingResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full"
          >
            <div className="mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Hand className="size-16 text-amber-400 mx-auto" />
              </motion.div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Preparando Pergunta {currentQuestionIndex + 1}</h2>
            <p className="text-slate-300 mb-6">Aguardando jogadores clicarem PRONTO!</p>

            {/* Ready counter */}
            <div className="bg-slate-700/50 rounded-2xl p-6 max-w-md mx-auto mb-6">
              <div className="text-5xl font-bold text-emerald-400 mb-2">
                {readyCount}/{players.length}
              </div>
              <p className="text-slate-300 text-sm mb-4">jogadores prontos</p>
              <Progress
                value={players.length > 0 ? (readyCount / players.length) * 100 : 0}
                className="h-3 bg-slate-600"
              />
            </div>

            {/* Who is ready */}
            <div className="max-w-md mx-auto mb-6">
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map((player) => {
                  const isReady = readyPlayerIds.includes(player.id)
                  return (
                    <motion.div
                      key={player.id}
                      animate={isReady ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                        isReady
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >
                      {isReady ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
                      {player.name}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Force start button */}
            {readyCount < players.length && (
              <Button
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={forceStart}
              >
                <Play className="size-4" />
                Iniciar Mesmo Assim ({readyCount}/{players.length} prontos)
              </Button>
            )}

            {readyCount >= players.length && players.length > 0 && (
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Loader2 className="size-5 animate-spin" />
                <span>Todos prontos! Iniciando...</span>
              </div>
            )}
          </motion.div>
        )}

        {/* ACTIVE QUESTION STATE - Question is live */}
        {!isPreparingQuestion && !showingResults && questionStartTime && (
          <>
            {/* Timer */}
            <div className="mb-6">
              <CircularTimer
                timeLimit={currentQuestion.timeLimit}
                startTime={questionStartTime}
              />
            </div>

            {/* Question Type Badge */}
            {currentQuestion.type === 'numeric' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
                  <Calculator className="size-4 mr-1" />
                  Resposta Numérica
                </Badge>
              </motion.div>
            )}

            {/* Question Text */}
            <motion.div
              key={`q-${currentQuestionIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold px-4">
                {currentQuestion.text}
              </h2>
            </motion.div>

            {currentQuestion.type === 'numeric' ? (
              <div className="w-full max-w-2xl">
                <div className="mb-6">
                  <div className="text-center text-slate-300 mb-4">
                    <HashIcon className="size-8 mx-auto mb-2 text-amber-400" />
                    <p className="text-sm">Os jogadores estão digitando seus números...</p>
                    <p className="text-lg font-semibold mt-1">{answerCount} de {players.length} respostas</p>
                  </div>
                  {hostNumericAnswers.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {hostNumericAnswers.map((entry, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-slate-700/50 rounded-lg px-4 py-2 flex items-center gap-3 text-sm"
                        >
                          <div className="bg-amber-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {entry.playerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-300">{entry.playerName}</span>
                          <span className="ml-auto font-mono text-amber-400 font-bold">{entry.numericAnswer}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-2xl">
                {currentQuestion.options.map((option, oIndex) => {
                  const isCorrect = showingResults && option.id === correctOptionId
                  const answers = answerDistribution[option.id || ''] || 0

                  return (
                    <motion.div
                      key={option.id || oIndex}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: oIndex * 0.05 }}
                      className={`game-option-btn rounded-xl p-4 sm:p-6 text-white font-semibold text-sm sm:text-base lg:text-lg relative ${
                        isCorrect ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1E293B]' : ''
                      }`}
                      style={{ backgroundColor: OPTION_COLORS[oIndex] }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-lg sm:text-xl">{OPTION_LABELS[oIndex]}</span>
                        <span className="flex-1">{option.text}</span>
                      </div>
                      {showingResults && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-2 text-xs sm:text-sm opacity-90"
                        >
                          {answers} resposta{answers !== 1 ? 's' : ''}
                        </motion.div>
                      )}
                      {isCorrect && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 bg-white text-emerald-600 rounded-full w-6 h-6 flex items-center justify-center"
                        >
                          <Check className="size-4" />
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* End question button */}
            <div className="mt-8">
              <Button
                size="lg"
                variant="destructive"
                className="text-white"
                onClick={endQuestion}
              >
                <X className="size-4" />
                Encerrar Pergunta
              </Button>
            </div>
          </>
        )}

        {/* RESULTS STATE - Showing question results */}
        {showingResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            {/* Question Type Badge */}
            {currentQuestion.type === 'numeric' && (
              <div className="mb-4 text-center">
                <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
                  <Calculator className="size-4 mr-1" />
                  Resposta Numérica
                </Badge>
              </div>
            )}

            {/* Question Text */}
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold px-4">{currentQuestion.text}</h2>
            </div>

            {currentQuestion.type === 'numeric' ? (
              <>
                {/* Correct Answer Display */}
                <div className="text-center mb-6">
                  <p className="text-slate-300 text-sm mb-2">Resposta Correta</p>
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="bg-amber-500 text-white rounded-2xl px-8 py-4 inline-block"
                  >
                    <span className="text-4xl font-bold font-mono">{correctNumericAnswer}</span>
                  </motion.div>
                </div>

                {/* Ranking by proximity */}
                {numericAnswerResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-slate-300 text-sm text-center mb-3">
                      <Target className="size-4 inline mr-1" />
                      Ranking por Proximidade
                    </p>
                    {numericAnswerResults.map((result, i) => (
                      <motion.div
                        key={result.playerId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                          i === 0 ? 'bg-emerald-600/30 border border-emerald-500/50' :
                          i === 1 ? 'bg-emerald-700/20 border border-emerald-600/30' :
                          i === 2 ? 'bg-emerald-800/20 border border-emerald-700/30' :
                          'bg-slate-700/50'
                        }`}
                      >
                        <span className="font-bold w-8 text-center text-slate-400">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <span className="font-medium">{result.playerName}</span>
                          <span className="ml-2 font-mono text-amber-400">{result.numericAnswer}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold text-sm">+{result.score} pts</div>
                          <div className="text-slate-400 text-xs">
                            {result.distance === 0 ? 'Exato!' : `±${result.distance}`}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Multiple Choice Results */
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
                {currentQuestion.options.map((option, oIndex) => {
                  const isCorrect = correctOptionId?.includes(option.id || '')
                  const answers = answerDistribution[option.id || ''] || 0

                  return (
                    <motion.div
                      key={option.id || oIndex}
                      className={`game-option-btn rounded-xl p-4 sm:p-6 text-white font-semibold text-sm sm:text-base lg:text-lg relative ${
                        isCorrect ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1E293B]' : 'opacity-60'
                      }`}
                      style={{ backgroundColor: OPTION_COLORS[oIndex] }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-lg sm:text-xl">{OPTION_LABELS[oIndex]}</span>
                        <span className="flex-1">{option.text}</span>
                      </div>
                      <div className="mt-2 text-xs sm:text-sm opacity-90">
                        {answers} resposta{answers !== 1 ? 's' : ''}
                      </div>
                      {isCorrect && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 bg-white text-emerald-600 rounded-full w-6 h-6 flex items-center justify-center"
                        >
                          <Check className="size-4" />
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Next question button */}
            <div className="mt-8 text-center">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={nextQuestion}
              >
                {currentQuestionIndex >= totalQuestions - 1 ? (
                  <>
                    <Trophy className="size-4" />
                    Ver Resultado Final
                  </>
                ) : (
                  <>
                    Próxima Pergunta
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* IDLE STATE - Show question info with "Enviar Pergunta" button */}
        {!isPreparingQuestion && !questionStartTime && !showingResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Pergunta {currentQuestionIndex + 1} de {totalQuestions}
            </h2>

            {currentQuestion.type === 'numeric' && (
              <Badge className="bg-amber-500 text-white text-sm px-3 py-1 mb-4">
                <Calculator className="size-4 mr-1" />
                Resposta Numérica
              </Badge>
            )}

            <p className="text-slate-300 mb-2">Quiz: {currentQuiz?.title}</p>
            <p className="text-slate-400 text-sm mb-8">
              Clique abaixo para enviar a pergunta. Os jogadores deverão clicar PRONTO! antes que a pergunta seja revelada.
            </p>

            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 py-6 h-auto"
              onClick={sendQuestion}
            >
              <Send className="size-5" />
              Enviar Pergunta
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  )
}

// ─── Host Results View ────────────────────────────────────────────────────────

function HostResultsView() {
  const { sessionId, currentQuiz, players, setView, socket, reset } = useAppStore()
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([])

  useEffect(() => {
    // Fetch leaderboard from API
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/leaderboard`)
        .then((res) => res.json())
        .then((data) => {
          if (data.leaderboard) {
            setLeaderboard(data.leaderboard)
          }
        })
        .catch(() => {
          // Fallback: use player data from store
          const sorted = [...players].sort((a, b) => b.score - a.score)
          setLeaderboard(sorted.map((p) => ({ name: p.name, score: p.score })))
        })
    }
  }, [sessionId, players])

  const handlePlayAgain = async () => {
    if (!currentQuiz) return
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: currentQuiz.id }),
      })
      if (res.ok) {
        const data = await res.json()
        const store = useAppStore.getState()
        socket?.disconnect()
        store.setSessionId(data.session.id)
        store.setGamePin(null)
        store.setPlayers([])
        store.setAnswerCount(0)
        store.setCurrentQuestionIndex(0)
        store.setQuestionEnded(false)
        store.setCorrectOptionId(null)
        store.setAnswerDistribution({})
        store.setReadyCount(0)
        store.setReadyPlayerIds([])
        store.setIsPreparingQuestion(false)
        store.setSocket(null)
        setView('host-lobby')
      }
    } catch {
      toast.error('Erro ao criar nova sessão')
    }
  }

  const handleExit = () => {
    socket?.disconnect()
    reset()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full">
        {/* Podium */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <Trophy className="size-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Resultado Final</h2>
          <p className="text-slate-300">{currentQuiz?.title}</p>
        </motion.div>

        {/* Podium Display */}
        {leaderboard.length > 0 && (
          <div className="flex items-end justify-center gap-3 mb-12 mt-8">
            {/* 2º Lugar */}
            {leaderboard.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <div className="bg-slate-500 rounded-t-xl p-3 w-24 h-28 flex flex-col items-center justify-center shadow-lg border-x border-t border-slate-400">
                  <Medal className="size-6 text-slate-200 mb-1" />
                  <span className="text-xs font-bold truncate w-full">{leaderboard[1].name}</span>
                  <span className="text-[10px] text-slate-200">{leaderboard[1].score} pts</span>
                </div>
                <div className="text-slate-400 font-bold mt-2">2º</div>
              </motion.div>
            )}

            {/* 1º Lugar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center z-10"
            >
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="bg-amber-500 rounded-t-xl p-3 w-28 h-40 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)] border-x border-t border-amber-300"
              >
                <Crown className="size-10 text-amber-100 mb-1" />
                <span className="text-sm font-black truncate w-full text-amber-950">{leaderboard[0].name}</span>
                <span className="text-xs font-bold text-amber-900">{leaderboard[0].score} pts</span>
              </motion.div>
              <div className="text-amber-500 font-black text-xl mt-2">1º</div>
            </motion.div>

            {/* 3º Lugar */}
            {leaderboard.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <div className="bg-orange-800 rounded-t-xl p-3 w-24 h-20 flex flex-col items-center justify-center shadow-lg border-x border-t border-orange-700">
                  <Award className="size-6 text-orange-200 mb-1" />
                  <span className="text-xs font-bold truncate w-full">{leaderboard[2].name}</span>
                  <span className="text-[10px] text-orange-200">{leaderboard[2].score} pts</span>
                </div>
                <div className="text-orange-700 font-bold mt-2">3º</div>
              </motion.div>
            )}
          </div>
        )}

        {/* Full Leaderboard */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="size-5 text-amber-400" />
              Classificação Completa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    index === 0 ? 'bg-amber-500/20 border border-amber-500/30' :
                    index === 1 ? 'bg-slate-500/20 border border-slate-400/30' :
                    index === 2 ? 'bg-amber-800/20 border border-amber-600/30' :
                    'bg-slate-700/50'
                  }`}
                >
                  <span className="font-bold w-6 text-center text-slate-400 text-sm">
                    {index + 1}
                  </span>
                  <div className="flex-1 font-medium text-sm truncate">{entry.name}</div>
                  <div className="font-bold text-emerald-400 text-sm">{entry.score}</div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="mt-6 mb-4 space-y-3">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handlePlayAgain}
          >
            <RotateCcw className="size-4" />
            Jogar Novamente
          </Button>
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-white"
            onClick={handleExit}
          >
            <LogOut className="size-4" />
            Voltar ao Início
          </Button>
        </div>
      </main>
    </div>
  )
}

// ─── Player Join View ─────────────────────────────────────────────────────────

function PlayerJoinView() {
  const { setView, setSocket, setPlayerId, setPlayerName, setSessionId } = useAppStore()
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = () => {
    if (!pin.trim() || !name.trim()) {
      toast.error('Preencha o PIN e seu nome')
      return
    }

    setJoining(true)
    const socket = connectSocket()
    setSocket(socket)

    // Emit player-join on every connect (including reconnections)
    socket.on('connect', () => {
      console.log('[PlayerJoin] Connected, emitting player-join')
      socket.emit('player-join', { pin: pin.trim(), name: name.trim() })
    })

    socket.on('join-success', (data: { sessionId: string; playerId: string; playerName: string }) => {
      setSessionId(data.sessionId)
      setPlayerId(data.playerId)
      setPlayerName(data.playerName)
      setJoining(false)
      setView('player-waiting')
    })

    socket.on('join-error', (data: { message: string }) => {
      toast.error(data.message || 'Erro ao entrar no jogo')
      socket.disconnect()
      setSocket(null)
      setJoining(false)
    })

    socket.io.on('reconnect', () => {
      console.log('[PlayerJoin] Reconnected')
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <img src="/logo.png" alt="StringQuiz Logo" className="h-8 w-auto object-contain" />
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white"
          onClick={() => setView('admin-login')}
        >
          <Lock className="size-4 mr-2" />
          Admin
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <img src="/logo.png" alt="StringQuiz Logo" className="h-24 w-auto mx-auto mb-6 object-contain drop-shadow-lg" />
            <h2 className="text-2xl font-bold">Entrar no Jogo</h2>
            <p className="text-slate-300 mt-1">Insira o código e seu nome</p>
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  <Hash className="size-4 inline mr-1" />
                  Código do Jogo (PIN)
                </label>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest h-14 bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  <Users className="size-4 inline mr-1" />
                  Seu Nome
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 20))}
                  placeholder="Digite seu nome"
                  className="text-center text-lg bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  maxLength={20}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg"
                onClick={handleJoin}
                disabled={joining || !pin.trim() || !name.trim()}
              >
                {joining ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <Send className="size-4" />
                    Entrar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="py-4 text-center text-slate-500 text-sm">
        QuizCorp &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}

// ─── Player Waiting View ──────────────────────────────────────────────────────

function PlayerWaitingView() {
  const { playerName, socket, setView, sessionId, currentQuiz, setPlayerCurrentQuestion, setPlayerQuestionStartTime, setCurrentQuestionId, setSelectedOptionId, setPlayerNumericAnswer, setLastAnswerCorrect } = useAppStore()
  const isConnected = socket?.connected ?? false

  useEffect(() => {
    if (!socket) return

    // When question-prepare is received, go to player-ready view (PRONTO! button)
    const handleQuestionPrepare = () => {
      console.log('[PlayerWaiting] Received question-prepare!')
      setView('player-ready')
    }

    // Also handle question-start in case host force-started (skipped prepare)
    const handleQuestionStart = (data: {
      questionIndex: number
      question: { id: string; text: string; type: string; timeLimit: number; options: { id: string; text: string; color: string }[] }
      startTime: number
    }) => {
      console.log('[PlayerWaiting] Received question-start! Going directly to game view.')
      setPlayerCurrentQuestion(data.question)
      setPlayerQuestionStartTime(data.startTime)
      setCurrentQuestionId(data.question.id)
      setSelectedOptionId(null)
      setPlayerNumericAnswer(null)
      setLastAnswerCorrect(null)
      setView('player-game')
    }

    socket.on('question-prepare', handleQuestionPrepare)
    socket.on('question-start', handleQuestionStart)

    return () => {
      socket.off('question-prepare', handleQuestionPrepare)
      socket.off('question-start', handleQuestionStart)
    }
  }, [socket, setView, setPlayerCurrentQuestion, setPlayerQuestionStartTime, setCurrentQuestionId, setSelectedOptionId, setPlayerNumericAnswer, setLastAnswerCorrect])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E293B] text-white p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-6"
        >
          <Sparkles className="size-16 text-emerald-400 mx-auto" />
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Você está no jogo!</h2>
        <p className="text-emerald-400 text-xl font-semibold mb-4">{playerName}</p>
        {currentQuiz?.title && (
          <p className="text-slate-300 mb-6">Quiz: {currentQuiz.title}</p>
        )}

        {/* Connection Status */}
        <div className={`flex items-center justify-center gap-2 mb-3 text-sm ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span>{isConnected ? 'Conectado' : 'Reconectando...'}</span>
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-400">
          <div className="animate-gentle-pulse">
            <Timer className="size-5" />
          </div>
          <span className="animate-gentle-pulse">Aguardando o host iniciar...</span>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Player Ready View (PRONTO! Button) ────────────────────────────────────────

function PlayerReadyView() {
  const { playerName, socket, sessionId, playerId, setView, isPlayerReady, setIsPlayerReady, setReadyCount, setReadyPlayerIds, setPlayerCurrentQuestion, setPlayerQuestionStartTime, setCurrentQuestionId, setSelectedOptionId, setPlayerNumericAnswer, setLastAnswerCorrect } = useAppStore()
  const [readyClicked, setReadyClicked] = useState(false)
  const isConnected = socket?.connected ?? false

  useEffect(() => {
    if (!socket) return

    // When question-prepare arrives, reset ready state
    const handleQuestionPrepare = () => {
      setReadyClicked(false)
      setIsPlayerReady(false)
    }

    // When question actually starts (all players ready), save question data to store THEN go to game view
    const handleQuestionStart = (data: {
      questionIndex: number
      question: { id: string; text: string; type: string; timeLimit: number; options: { id: string; text: string; color: string }[] }
      startTime: number
    }) => {
      console.log('[PlayerReady] Received question-start! Saving to store and going to game view.')
      // CRITICAL: Save question data to Zustand BEFORE changing view so PlayerGameView can read it
      setPlayerCurrentQuestion(data.question)
      setPlayerQuestionStartTime(data.startTime)
      setCurrentQuestionId(data.question.id)
      setSelectedOptionId(null)
      setPlayerNumericAnswer(null)
      setLastAnswerCorrect(null)
      setIsPlayerReady(false)
      setView('player-game')
    }

    // Update ready count display
    const handlePlayersReadyUpdate = (data: { readyCount: number; totalPlayers: number; readyPlayerIds: string[] }) => {
      setReadyCount(data.readyCount)
      setReadyPlayerIds(data.readyPlayerIds)
    }

    socket.on('question-prepare', handleQuestionPrepare)
    socket.on('question-start', handleQuestionStart)
    socket.on('players-ready-update', handlePlayersReadyUpdate)

    return () => {
      socket.off('question-prepare', handleQuestionPrepare)
      socket.off('question-start', handleQuestionStart)
      socket.off('players-ready-update', handlePlayersReadyUpdate)
    }
  }, [socket, setView, setIsPlayerReady, setReadyCount, setReadyPlayerIds, setPlayerCurrentQuestion, setPlayerQuestionStartTime, setCurrentQuestionId, setSelectedOptionId, setPlayerNumericAnswer, setLastAnswerCorrect])

  const handleReady = () => {
    if (!socket || !sessionId || readyClicked) return
    setReadyClicked(true)
    setIsPlayerReady(true)
    socket.emit('player-ready', { sessionId })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E293B] text-white p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mb-8"
        >
          <Hand className="size-20 text-amber-400 mx-auto" />
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Prepare-se!</h2>
        <p className="text-slate-300 text-lg mb-2">{playerName}</p>
        <p className="text-slate-400 text-sm mb-8">Uma nova pergunta está chegando!</p>

        {/* Connection Status */}
        <div className={`flex items-center justify-center gap-2 mb-6 text-sm ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span>{isConnected ? 'Conectado' : 'Reconectando...'}</span>
        </div>

        {/* PRONTO! Button */}
        <motion.div
          whileHover={{ scale: readyClicked ? 1 : 1.05 }}
          whileTap={{ scale: readyClicked ? 1 : 0.95 }}
        >
          <Button
            size="lg"
            disabled={readyClicked}
            className={`text-2xl px-12 py-8 h-auto font-bold ${
              readyClicked
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-amber-500 hover:bg-amber-400 text-white animate-pulse'
            }`}
            onClick={handleReady}
          >
            {readyClicked ? (
              <>
                <Check className="size-8 mr-2" />
                PRONTO!
              </>
            ) : (
              <>
                <ThumbsUp className="size-8 mr-2" />
                PRONTO!
              </>
            )}
          </Button>
        </motion.div>

        {readyClicked && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-emerald-400 mt-4 text-sm"
          >
            Aguardando os outros jogadores...
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}

// ─── Player Game View ─────────────────────────────────────────────────────────

function PlayerGameView() {
  const {
    socket, sessionId, playerId,
    selectedOptionId, setSelectedOptionId,
    selectedOptionIds, setSelectedOptionIds,
    lastAnswerCorrect, setLastAnswerCorrect,
    currentQuestionId, setCurrentQuestionId,
    setView, setPlayerScore, playerScore,
    playerNumericAnswer, setPlayerNumericAnswer,
    playerCurrentQuestion, setPlayerCurrentQuestion,
    playerQuestionStartTime, setPlayerQuestionStartTime,
  } = useAppStore()

  // Initialize question from Zustand store (persisted across view transitions)
  const [question, setQuestion] = useState<{
    id: string
    text: string
    type: string
    timeLimit: number
    options: { id: string; text: string; color: string }[]
  } | null>(playerCurrentQuestion)
  const [questionStartTime, setQStartTime] = useState(playerQuestionStartTime)
  const [showResult, setShowResult] = useState(false)
  const [correctOptionId, setCorrectOptId] = useState<string | null>(null)
  const [correctNumericAnswer, setCorrectNumericAnswer] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(playerCurrentQuestion?.timeLimit ?? 0)
  const [numericInput, setNumericInput] = useState('')
  const [numericScore, setNumericScore] = useState<number | null>(null)
  const [numericDistance, setNumericDistance] = useState<number | null>(null)
  const [loadError, setLoadError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!socket) return

    const handleQuestionStart = (data: {
      questionIndex: number
      question: { id: string; text: string; type: string; timeLimit: number; options: { id: string; text: string; color: string }[] }
      startTime: number
    }) => {
      console.log('[PlayerGame] Received question-start with question:', data.question?.text?.substring(0, 30))
      setQuestion(data.question)
      setQStartTime(data.startTime)
      setCurrentQuestionId(data.question.id)
      setSelectedOptionId(null)
      setPlayerNumericAnswer(null)
      setLastAnswerCorrect(null)
      setShowResult(false)
      setCorrectOptId(null)
      setCorrectNumericAnswer(null)
      setAnswered(false)
      setTimeLeft(data.question.timeLimit)
      setNumericInput('')
      setNumericScore(null)
      setNumericDistance(null)
      setLoadError(false)
      // Also persist to store in case of view re-render
      setPlayerCurrentQuestion(data.question)
      setPlayerQuestionStartTime(data.startTime)
    }

    const handleQuestionEnd = (data: {
      correctOptionId?: string
      correctNumericAnswer?: number
      questionIndex: number
      questionType?: string
      answerResults?: NumericAnswerResult[]
    }) => {
      setShowResult(true)
      if (data.questionType === 'numeric') {
        setCorrectNumericAnswer(data.correctNumericAnswer ?? null)
        const myResult = data.answerResults?.find((r) => r.playerId === useAppStore.getState().playerId)
        if (myResult) {
          setNumericScore(myResult.score)
          setNumericDistance(myResult.distance)
          setLastAnswerCorrect(myResult.distance === 0)
        }
      } else {
        setCorrectOptId(data.correctOptionId || null)
        const selected = useAppStore.getState().selectedOptionId
        if (selected && data.correctOptionId) {
          setLastAnswerCorrect(selected === data.correctOptionId)
        }
      }
    }

    const handleGameEnd = (data: { leaderboard: { name: string; score: number }[] }) => {
      const store = useAppStore.getState()
      const myEntry = data.leaderboard.find((e) => e.name === store.playerName)
      if (myEntry) {
        setPlayerScore(myEntry.score)
      }
      store.setLeaderboard(data.leaderboard)
      setView('player-results')
    }

    // When host prepares next question, go back to player-ready view (PRONTO! button)
    const handleQuestionPrepare = () => {
      // Clear current question and go to ready view
      setQuestion(null)
      setPlayerCurrentQuestion(null)
      setPlayerQuestionStartTime(0)
      setShowResult(false)
      setAnswered(false)
      setView('player-ready')
    }

    socket.on('question-start', handleQuestionStart)
    socket.on('question-end', handleQuestionEnd)
    socket.on('game-end', handleGameEnd)
    socket.on('question-prepare', handleQuestionPrepare)

    return () => {
      socket.off('question-start', handleQuestionStart)
      socket.off('question-end', handleQuestionEnd)
      socket.off('game-end', handleGameEnd)
      socket.off('question-prepare', handleQuestionPrepare)
    }
  }, [socket, setView, setSelectedOptionId, setLastAnswerCorrect, setCurrentQuestionId, setPlayerScore, setPlayerNumericAnswer, setPlayerCurrentQuestion, setPlayerQuestionStartTime])

  // Timeout fallback: if no question after 10 seconds, show error instead of infinite spinner
  useEffect(() => {
    if (question) {
      return
    }
    const timer = setTimeout(() => {
      setLoadError(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [question])

  // Timer countdown
  useEffect(() => {
    if (!questionStartTime || !question || showResult) return

    const updateTimer = () => {
      const elapsed = (Date.now() - questionStartTime) / 1000
      const remaining = Math.max(0, question.timeLimit - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    intervalRef.current = setInterval(updateTimer, 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [questionStartTime, question, showResult])

  const handleSelectOption = (optionId: string) => {
    if (answered || !question || !socket) return

    setSelectedOptionId(optionId)
    setAnswered(true)

    const timeElapsed = (Date.now() - questionStartTime) / 1000
    socket.emit('player-answer', {
      sessionId,
      questionId: question.id,
      optionId,
      timeElapsed,
    })
  }

  const handleNumericSubmit = () => {
    if (answered || !question || !socket || !numericInput.trim()) return

    const numValue = parseFloat(numericInput)
    if (isNaN(numValue)) {
      toast.error('Digite um número válido')
      return
    }

    setPlayerNumericAnswer(numValue)
    setAnswered(true)

    const timeElapsed = (Date.now() - questionStartTime) / 1000
    socket.emit('player-answer', {
      sessionId,
      questionId: question.id,
      numericAnswer: numValue,
      timeElapsed,
    })
  }

  const getColorForOption = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      red: '#E21B3C',
      blue: '#1368CE',
      yellow: '#D89E00',
      green: '#26890C',
    }
    return colorMap[colorName] || '#64748B'
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1E293B] text-white p-4">
        {loadError ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <X className="size-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao carregar pergunta</h2>
            <p className="text-slate-400 mb-6">A pergunta não foi recebida do servidor.</p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setView('player-waiting')}
            >
              Voltar à sala de espera
            </Button>
          </motion.div>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-emerald-400" />
            <p className="mt-4 text-slate-300">Carregando pergunta...</p>
          </>
        )}
      </div>
    )
  }

  const timerPercentage = question.timeLimit > 0 ? (timeLeft / question.timeLimit) * 100 : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      {/* Timer bar at top */}
      <div className="w-full h-2 bg-slate-700">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${timerPercentage}%`,
            backgroundColor:
              timeLeft > question.timeLimit * 0.5
                ? '#10B981'
                : timeLeft > question.timeLimit * 0.25
                  ? '#D89E00'
                  : '#E21B3C',
          }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Question */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {question.type === 'numeric' && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1 mb-3">
              <Calculator className="size-4 mr-1" />
              Resposta Numérica
            </Badge>
          )}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold px-2">
            {question.text}
          </h2>
        </motion.div>

        {question.type === 'numeric' ? (
          /* Numeric Input */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm"
          >
            {!showResult ? (
              <div>
                <div className="text-center mb-4">
                  <HashIcon className="size-10 mx-auto text-amber-400 mb-2" />
                  <p className="text-slate-300 text-sm">Digite sua resposta numérica</p>
                  <p className="text-amber-400 text-xs mt-1">Quanto mais perto, mais pontos!</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="any"
                    value={numericInput}
                    onChange={(e) => setNumericInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNumericSubmit()
                    }}
                    placeholder="Sua resposta..."
                    disabled={answered}
                    className="text-center text-2xl font-mono h-14 bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500"
                  />
                  <Button
                    onClick={handleNumericSubmit}
                    disabled={answered || !numericInput.trim()}
                    className="bg-amber-500 hover:bg-amber-600 text-white h-14 px-6 text-lg font-bold shrink-0"
                  >
                    <Send className="size-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                {/* Show correct answer */}
                <p className="text-slate-300 text-sm mb-2">Resposta Correta</p>
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="bg-amber-500 text-white rounded-2xl px-8 py-4 inline-block mb-4"
                >
                  <span className="text-3xl font-bold font-mono">{correctNumericAnswer}</span>
                </motion.div>

                {/* Show player's answer and score */}
                {playerNumericAnswer !== null && (
                  <div className="mt-4 space-y-2">
                    <p className="text-slate-400 text-sm">Sua resposta</p>
                    <p className="text-2xl font-bold font-mono">{playerNumericAnswer}</p>
                    {numericDistance !== null && (
                      <p className="text-slate-400 text-sm">
                        {numericDistance === 0 ? (
                          <span className="text-emerald-400">Exato!</span>
                        ) : (
                          <span>Distância: ±{numericDistance}</span>
                        )}
                      </p>
                    )}
                    {numericScore !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2"
                      >
                        <span className="text-emerald-400 text-2xl font-bold">+{numericScore} pts</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
              {question.options.map((option, oIndex) => {
                const bgColor = getColorForOption(option.color)
                const isMulti = question.type === 'multi_select'
                const isSelected = isMulti 
                  ? (selectedOptionIds || []).includes(option.id) 
                  : selectedOptionId === option.id
                
                const isCorrect = showResult && (correctOptionId || '').includes(option.id)
                const isWrong = showResult && isSelected && !(correctOptionId || '').includes(option.id)

                const handlePress = () => {
                  if (answered) return
                  if (isMulti) {
                    const currentIds = selectedOptionIds || []
                    const newIds = isSelected 
                      ? currentIds.filter(id => id !== option.id)
                      : [...currentIds, option.id]
                    setSelectedOptionIds(newIds)
                  } else {
                    handleSelectOption(option.id)
                  }
                }

                return (
                  <motion.button
                    key={option.id}
                    onClick={handlePress}
                    disabled={answered}
                    className={`game-option-btn rounded-xl p-4 sm:p-6 text-white font-semibold relative min-h-20 ${
                      isSelected && !showResult ? 'ring-4 ring-white/50' : ''
                    } ${isCorrect ? 'ring-4 ring-white' : ''} ${
                      isWrong ? 'ring-4 ring-red-300 opacity-70' : ''
                    } ${answered && !isSelected && !isCorrect ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-5 h-5 border-2 border-white flex items-center justify-center shrink-0 mt-0.5 ${isMulti ? 'rounded-sm' : 'rounded-full'}`}>
                        {isSelected && <Check className="size-3" />}
                      </div>
                      <span className="flex-1 text-left text-sm sm:text-base">{option.text}</span>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Botão de confirmação para Múltipla Seleção */}
            {question.type === 'multi_select' && !answered && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 text-lg font-bold shadow-lg"
                  disabled={(selectedOptionIds || []).length === 0}
                  onClick={() => {
                    setAnswered(true)
                    socket?.emit('player-answer', {
                      sessionId,
                      questionId: question.id,
                      optionIds: selectedOptionIds,
                      timeElapsed: (Date.now() - (questionStartTime || 0)) / 1000
                    })
                  }}
                >
                  Confirmar Respostas ({(selectedOptionIds || []).length})
                </Button>
              </motion.div>
            )}
          </div>
        )}

        {/* Status Messages */}
        <AnimatePresence>
          {answered && !showResult && question.type === 'numeric' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-2 text-amber-400"
            >
              <Check className="size-5" />
              Resposta enviada! ({playerNumericAnswer})
            </motion.div>
          )}
          {answered && !showResult && question.type !== 'numeric' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-2 text-emerald-400"
            >
              <Check className="size-5" />
              Resposta enviada!
            </motion.div>
          )}
          {showResult && lastAnswerCorrect && question.type !== 'numeric' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 text-center"
            >
              <p className="text-emerald-400 text-2xl font-bold">Correto!</p>
            </motion.div>
          )}
          {showResult && lastAnswerCorrect === false && question.type !== 'numeric' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 text-center"
            >
              <p className="text-red-400 text-xl font-bold">Incorreto</p>
              <p className="text-slate-400 text-sm mt-1">A resposta correta está destacada</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// ─── Player Results View ──────────────────────────────────────────────────────

function PlayerResultsView() {
  const { playerName, playerScore, leaderboard, reset, socket } = useAppStore()

  const myRank =
    leaderboard.findIndex((e) => e.name === playerName) + 1

  const handleExit = () => {
    socket?.disconnect()
    reset()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1E293B] text-white">
      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <Trophy className="size-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Jogo Finalizado!</h2>
          <p className="text-slate-300">{playerName}</p>
        </motion.div>

        {/* Score Card */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-slate-400 text-sm mb-1">Sua Pontuação</p>
            <p className="text-4xl font-bold text-emerald-400">{playerScore}</p>
            <p className="text-slate-400 text-sm mt-1">
              {myRank > 0 ? `${myRank}º lugar` : ''}
            </p>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="size-5 text-amber-400" />
              Classificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {leaderboard.slice(0, 10).map((entry, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    entry.name === playerName
                      ? 'bg-emerald-900/30 border border-emerald-700'
                      : 'bg-slate-700/50'
                  }`}
                >
                  <span className="font-bold w-6 text-center text-slate-400 text-sm">
                    {index + 1}
                  </span>
                  <div className="flex-1 font-medium text-sm truncate">{entry.name}</div>
                  <div className="font-bold text-emerald-400 text-sm">{entry.score}</div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exit Button */}
        <div className="mt-6 mb-4">
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-white"
            onClick={handleExit}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </main>

      <footer className="py-4 text-center text-slate-500 text-sm">
        QuizCorp &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { view } = useAppStore()
  return (
    <AnimatePresence mode="wait">
      {view === 'admin-login' && <AdminLoginView key="admin-login" />}
      {view === 'dashboard' && <DashboardView key="dashboard" />}
      {view === 'editor' && <EditorView key="editor" />}
      {view === 'host-lobby' && <HostLobbyView key="host-lobby" />}
      {view === 'host-game' && <HostGameView key="host-game" />}
      {view === 'host-results' && <HostResultsView key="host-results" />}
      {view === 'player-join' && <PlayerJoinView key="player-join" />}
      {view === 'player-waiting' && <PlayerWaitingView key="player-waiting" />}
      {view === 'player-ready' && <PlayerReadyView key="player-ready" />}
      {view === 'player-game' && <PlayerGameView key="player-game" />}
      {view === 'player-results' && <PlayerResultsView key="player-results" />}
    </AnimatePresence>
  )
}

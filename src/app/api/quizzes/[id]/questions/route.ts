import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params
    const body = await request.json()
    const { text, timeLimit, options } = body

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      )
    }

    const quiz = await db.quiz.findUnique({ where: { id: quizId } })
    if (!quiz) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      )
    }

    const existingQuestionCount = await db.question.count({
      where: { quizId },
    })

    const bodyType = body.type || 'multiple_choice'
    const correctNumericAnswer = body.correctNumericAnswer ?? null

    const question = await db.question.create({
      data: {
        quizId,
        text: text.trim(),
        type: bodyType,
        correctNumericAnswer: bodyType === 'numeric' ? correctNumericAnswer : null,
        timeLimit: timeLimit ?? 20,
        order: existingQuestionCount,
        options: bodyType === 'multiple_choice' ? {
          create: (options as Array<{ text: string; isCorrect: boolean; color?: string }>).map(
            (option, index) => ({
              text: option.text.trim(),
              isCorrect: option.isCorrect ?? false,
              color: option.color ?? 'gray',
              order: index,
            })
          ),
        } : undefined,
      },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ question }, { status: 201 })
  } catch (error) {
    console.error('Error creating question:', error)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params
    const body = await request.json()
    const { questions } = body as {
      questions: Array<{
        id?: string
        text: string
        type?: string
        correctNumericAnswer?: number | null
        timeLimit: number
        order: number
        options: Array<{
          id?: string
          text: string
          isCorrect: boolean
          color: string
          order: number
        }>
      }>
    }

    const quiz = await db.quiz.findUnique({ where: { id: quizId } })
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    // 1. Buscar questões atuais para saber o que deletar
    const existingQuestions = await db.question.findMany({
      where: { quizId },
      select: { id: true }
    })

    const incomingQuestionIds = questions.map(q => q.id).filter(Boolean) as string[]
    const questionsToDelete = existingQuestions
      .map(q => q.id)
      .filter(id => !incomingQuestionIds.includes(id))

    // Deletar questões removidas
    if (questionsToDelete.length > 0) {
      await db.question.deleteMany({
        where: { id: { in: questionsToDelete } }
      })
    }

    // 2. Processar cada questão (Update ou Create)
    for (const questionData of questions) {
      const questionType = questionData.type || 'multiple_choice'
      
      if (questionData.id) {
        // Atualizar questão existente
        await db.question.update({
          where: { id: questionData.id },
          data: {
            text: questionData.text.trim(),
            type: questionType,
            correctNumericAnswer: questionType === 'numeric' ? (questionData.correctNumericAnswer ?? null) : null,
            timeLimit: questionData.timeLimit,
            order: questionData.order,
            options: {
              // Deletar opções que não vieram no novo payload
              deleteMany: {
                questionId: questionData.id,
                id: { notIn: questionData.options.map(o => o.id).filter(Boolean) as string[] }
              },
              // Upsert das opções restantes
              upsert: questionData.options.map((option) => ({
                where: { id: option.id || 'new-option-' + Math.random() },
                update: {
                  text: option.text.trim(),
                  isCorrect: option.isCorrect,
                  color: option.color,
                  order: option.order,
                },
                create: {
                  text: option.text.trim(),
                  isCorrect: option.isCorrect,
                  color: option.color,
                  order: option.order,
                },
              })),
            },
          },
        })
      } else {
        // Criar nova questão
        await db.question.create({
          data: {
            quizId,
            text: questionData.text.trim(),
            type: questionType,
            correctNumericAnswer: questionType === 'numeric' ? (questionData.correctNumericAnswer ?? null) : null,
            timeLimit: questionData.timeLimit,
            order: questionData.order,
            options: {
              create: questionData.options.map((option) => ({
                text: option.text.trim(),
                isCorrect: option.isCorrect,
                color: option.color,
                order: option.order,
              })),
            },
          },
        })
      }
    }

    const updatedQuiz = await db.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    })

    return NextResponse.json({ quiz: updatedQuiz })
  } catch (error) {
    console.error('Error updating questions:', error)
    return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')

    if (!questionId) {
      return NextResponse.json(
        { error: 'questionId query parameter is required' },
        { status: 400 }
      )
    }

    const question = await db.question.findUnique({
      where: { id: questionId },
    })

    if (!question || question.quizId !== quizId) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    await db.question.delete({ where: { id: questionId } })

    return NextResponse.json({ message: 'Question deleted successfully' })
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}

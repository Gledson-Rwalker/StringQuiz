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

    const bodyType = body.type || 'multiple_choice'
    const correctNumericAnswer = body.correctNumericAnswer ?? null
    
    // Define se o tipo de pergunta exige opções (Múltipla Escolha ou Múltipla Seleção)
    const needsOptions = bodyType === 'multiple_choice' || bodyType === 'multi_select'

    const existingQuestionCount = await db.question.count({ where: { quizId } })

    const question = await db.question.create({
      data: {
        quizId,
        text: text.trim(),
        type: bodyType,
        correctNumericAnswer: bodyType === 'numeric' ? correctNumericAnswer : null,
        timeLimit: timeLimit ?? 20,
        order: existingQuestionCount,
        options: needsOptions ? {
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
      include: { options: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ question }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params
    const body = await request.json()
    const { questions } = body

    const quiz = await db.quiz.findUnique({ where: { id: quizId } })
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

    const existingQuestions = await db.question.findMany({
      where: { quizId },
      select: { id: true }
    })

    const incomingQuestionIds = questions.map((q: any) => q.id).filter(Boolean)
    const questionsToDelete = existingQuestions
      .map(q => q.id)
      .filter(id => !incomingQuestionIds.includes(id))

    if (questionsToDelete.length > 0) {
      await db.question.deleteMany({ where: { id: { in: questionsToDelete } } })
    }

    for (const questionData of questions) {
      const questionType = questionData.type || 'multiple_choice'
      const needsOptions = questionType === 'multiple_choice' || questionType === 'multi_select'
      
      if (questionData.id) {
        await db.question.update({
          where: { id: questionData.id },
          data: {
            text: questionData.text.trim(),
            type: questionType,
            correctNumericAnswer: questionType === 'numeric' ? (questionData.correctNumericAnswer ?? null) : null,
            timeLimit: questionData.timeLimit,
            order: questionData.order,
            options: needsOptions ? {
              deleteMany: {
                id: { notIn: questionData.options.map((o: any) => o.id).filter(Boolean) }
              },
              upsert: questionData.options.map((option: any) => ({
                where: { id: option.id || 'new-' + Math.random() },
                update: { text: option.text.trim(), isCorrect: option.isCorrect, color: option.color, order: option.order },
                create: { text: option.text.trim(), isCorrect: option.isCorrect, color: option.color, order: option.order },
              })),
            } : { deleteMany: {} }, // Se virou numérica, deleta todas as opções
          },
        })
      } else {
        await db.question.create({
          data: {
            quizId,
            text: questionData.text.trim(),
            type: questionType,
            correctNumericAnswer: questionType === 'numeric' ? (questionData.correctNumericAnswer ?? null) : null,
            timeLimit: questionData.timeLimit,
            order: questionData.order,
            options: needsOptions ? {
              create: questionData.options.map((option: any) => ({
                text: option.text.trim(),
                isCorrect: option.isCorrect,
                color: option.color,
                order: option.order,
              })),
            } : undefined,
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
    console.error(error)
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
    if (!questionId) return NextResponse.json({ error: 'Id required' }, { status: 400 })

    await db.question.delete({ where: { id: questionId, quizId } })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
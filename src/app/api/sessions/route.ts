import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizId } = body

    if (!quizId || typeof quizId !== 'string') {
      return NextResponse.json(
        { error: 'quizId is required' },
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

    // Generate a unique PIN
    let pin = generatePin()
    let existingSession = await db.gameSession.findUnique({ where: { pin } })
    while (existingSession) {
      pin = generatePin()
      existingSession = await db.gameSession.findUnique({ where: { pin } })
    }

    const session = await db.gameSession.create({
      data: {
        quizId,
        pin,
        status: 'waiting',
      },
      include: {
        quiz: {
          select: { title: true },
        },
      },
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pin = searchParams.get('pin')

    if (!pin) {
      return NextResponse.json(
        { error: 'pin query parameter is required' },
        { status: 400 }
      )
    }

    const session = await db.gameSession.findUnique({
      where: { pin },
      include: {
        quiz: {
          select: {
            title: true,
            description: true,
            category: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

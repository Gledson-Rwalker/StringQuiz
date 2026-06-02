import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await db.gameSession.findUnique({
      where: { id },
      include: {
        quiz: {
          select: {
            title: true,
            description: true,
            category: true,
          },
        },
        players: {
          orderBy: { score: 'desc' },
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['waiting', 'active', 'finished'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (waiting, active, finished)' },
        { status: 400 }
      )
    }

    const existingSession = await db.gameSession.findUnique({
      where: { id },
    })
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const session = await db.gameSession.update({
      where: { id },
      data: { status },
      include: {
        quiz: {
          select: { title: true },
        },
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

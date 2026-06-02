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
          include: {
            _count: {
              select: { questions: true },
            },
          },
        },
        players: {
          orderBy: { score: 'desc' },
          select: {
            id: true,
            name: true,
            score: true,
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

    const leaderboard = session.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score,
    }))

    return NextResponse.json({
      leaderboard,
      totalQuestions: session.quiz._count.questions,
    })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

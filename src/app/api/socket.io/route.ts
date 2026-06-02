import { NextRequest, NextResponse } from 'next/server'

const WS_URL = process.env.WS_SERVICE_URL || 'http://localhost:3003'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const targetUrl = `${WS_URL}/?${searchParams}`
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain',
      },
    })
    
    const body = await response.text()
    
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error: any) {
    console.error('[Socket.IO Proxy GET Error]', error.message)
    return new NextResponse('Proxy Error', { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const targetUrl = `${WS_URL}/?${searchParams}`
    
    const body = await request.text()
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'text/plain',
      },
    })
    
    const responseBody = await response.text()
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error: any) {
    console.error('[Socket.IO Proxy POST Error]', error.message)
    return new NextResponse('Proxy Error', { status: 502 })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Clear existing data
    await db.playerAnswer.deleteMany()
    await db.player.deleteMany()
    await db.gameSession.deleteMany()
    await db.option.deleteMany()
    await db.question.deleteMany()
    await db.quiz.deleteMany()

    // Quiz 1: Onboarding Corporativo
    const onboardingQuiz = await db.quiz.create({
      data: {
        title: 'Onboarding Corporativo',
        description:
          'Teste seus conhecimentos sobre a cultura e valores da empresa!',
        category: 'Cultura',
        questions: {
          create: [
            {
              text: 'Qual é o valor principal da nossa empresa?',
              timeLimit: 20,
              order: 0,
              options: {
                create: [
                  {
                    text: 'Lucro acima de tudo',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Inovação com propósito',
                    isCorrect: true,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Conformidade rigída',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Hierarquia estrita',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'Como descrevemos nosso ambiente de trabalho?',
              timeLimit: 20,
              order: 1,
              options: {
                create: [
                  {
                    text: 'Formal e tradicional',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Competitivo e individualista',
                    isCorrect: false,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Colaborativo e inclusivo',
                    isCorrect: true,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Descontraído sem regras',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'Qual é o nosso modelo de trabalho preferido?',
              timeLimit: 20,
              order: 2,
              options: {
                create: [
                  {
                    text: '100% presencial',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Híbrido com flexibilidade',
                    isCorrect: true,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: '100% remoto obrigatório',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Qualquer lugar do mundo',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'O que esperamos de um novo colaborador nos primeiros 30 dias?',
              timeLimit: 25,
              order: 3,
              options: {
                create: [
                  {
                    text: 'Entregar resultados imediatos',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Conhecer a equipe e os processos',
                    isCorrect: true,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Propor mudanças radicais',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Trabalhar horas extras todos os dias',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'Qual programa interno apoia o desenvolvimento contínuo?',
              timeLimit: 20,
              order: 4,
              options: {
                create: [
                  {
                    text: 'Academia Corporativa',
                    isCorrect: true,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Apenas cursos externos',
                    isCorrect: false,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Não temos programa de desenvolvimento',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Apenas mentorias informais',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    })

    // Quiz 2: Segurança da Informação
    const infosecQuiz = await db.quiz.create({
      data: {
        title: 'Segurança da Informação',
        description:
          'Descubra o quanto você sabe sobre proteção de dados e segurança digital!',
        category: 'Segurança',
        questions: {
          create: [
            {
              text: 'Qual é a melhor prática para criar senhas seguras?',
              type: 'multiple_choice',
              timeLimit: 20,
              order: 0,
              options: {
                create: [
                  {
                    text: 'Usar seu nome e data de nascimento',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Combinar letras maiúsculas, minúsculas, números e símbolos',
                    isCorrect: true,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Usar a mesma senha em todos os sites',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Usar "123456" para não esquecer',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'O que é phishing?',
              type: 'multiple_choice',
              timeLimit: 20,
              order: 1,
              options: {
                create: [
                  {
                    text: 'Um tipo de vírus de computador',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Uma técnica de pesca esportiva',
                    isCorrect: false,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Uma tentativa de engenharia social por e-mail ou mensagem',
                    isCorrect: true,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Um programa de proteção de dados',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'O que você deve fazer ao receber um e-mail suspeito com link?',
              type: 'multiple_choice',
              timeLimit: 20,
              order: 2,
              options: {
                create: [
                  {
                    text: 'Clicar no link para verificar',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Encaminhar para todos os colegas',
                    isCorrect: false,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Ignorar e deletar sem reportar',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Reportar ao time de segurança da informação',
                    isCorrect: true,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'O que é autenticação de dois fatores (2FA)?',
              type: 'multiple_choice',
              timeLimit: 25,
              order: 3,
              options: {
                create: [
                  {
                    text: 'Usar duas senhas diferentes no mesmo site',
                    isCorrect: false,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'Método que exige duas formas de verificação de identidade',
                    isCorrect: true,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'Acessar de dois navegadores ao mesmo tempo',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Compartilhar a conta com outra pessoa',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
            {
              text: 'Qual lei brasileira regula a proteção de dados pessoais?',
              type: 'multiple_choice',
              timeLimit: 20,
              order: 4,
              options: {
                create: [
                  {
                    text: 'LGPD - Lei Geral de Proteção de Dados',
                    isCorrect: true,
                    color: 'red',
                    order: 0,
                  },
                  {
                    text: 'CDC - Código de Defesa do Consumidor',
                    isCorrect: false,
                    color: 'blue',
                    order: 1,
                  },
                  {
                    text: 'CLT - Consolidação das Leis do Trabalho',
                    isCorrect: false,
                    color: 'yellow',
                    order: 2,
                  },
                  {
                    text: 'Marco Civil da Internet',
                    isCorrect: false,
                    color: 'green',
                    order: 3,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    })

    // Quiz 3: Conhecimentos Gerais - Numérico
    const numericQuiz = await db.quiz.create({
      data: {
        title: 'Conhecimentos Gerais - Numérico',
        description:
          'Responda com números! Quanto mais perto da resposta correta, mais pontos você ganha!',
        category: 'Cultura',
        questions: {
          create: [
            {
              text: 'Qual o ano do descobrimento do Brasil?',
              type: 'numeric',
              correctNumericAnswer: 1500,
              timeLimit: 20,
              order: 0,
            },
            {
              text: 'Quantos estados tem o Brasil?',
              type: 'numeric',
              correctNumericAnswer: 26,
              timeLimit: 15,
              order: 1,
            },
            {
              text: 'Em que ano a Primeira Guerra Mundial começou?',
              type: 'numeric',
              correctNumericAnswer: 1914,
              timeLimit: 20,
              order: 2,
            },
            {
              text: 'Quantos ossos tem o corpo humano adulto?',
              type: 'numeric',
              correctNumericAnswer: 206,
              timeLimit: 25,
              order: 3,
            },
            {
              text: 'Qual a temperatura de ebulição da água em graus Celsius?',
              type: 'numeric',
              correctNumericAnswer: 100,
              timeLimit: 15,
              order: 4,
            },
          ],
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    })

    return NextResponse.json({
      message: 'Seed data created successfully',
      quizzes: [
        {
          id: onboardingQuiz.id,
          title: onboardingQuiz.title,
          questionsCount: onboardingQuiz.questions.length,
        },
        {
          id: infosecQuiz.id,
          title: infosecQuiz.title,
          questionsCount: infosecQuiz.questions.length,
        },
        {
          id: numericQuiz.id,
          title: numericQuiz.title,
          questionsCount: numericQuiz.questions.length,
        },
      ],
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    )
  }
}

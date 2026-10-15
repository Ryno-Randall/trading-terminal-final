const functions = [
  {
    type: 'function',
    function: {
      name: 'move_sheep',
      description: 'Move selected sheep or a count of sheep between camps.',
      parameters: {
        type: 'object',
        properties: { fromCamp: { type: 'string' }, toCamp: { type: 'string' }, sheepIds: { type: 'array', items: { type: 'string' } }, count: { type: 'integer' } },
        required: ['fromCamp', 'toCamp'], additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mass_vaccinate',
      description: 'Vaccinate all sheep in a camp.',
      parameters: { type: 'object', properties: { campId: { type: 'string' }, vaccineName: { type: 'string' }, date: { type: 'string' }, dosage: { type: 'string' } }, required: ['campId', 'vaccineName'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mass_dose',
      description: 'Dose all sheep in a camp.',
      parameters: { type: 'object', properties: { campId: { type: 'string' }, medicineName: { type: 'string' }, date: { type: 'string' } }, required: ['campId', 'medicineName'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_vaccine_record',
      description: 'Add a vaccine record to one sheep.',
      parameters: { type: 'object', properties: { sheepId: { type: 'string' }, vaccineName: { type: 'string' }, date: { type: 'string' } }, required: ['sheepId', 'vaccineName'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_calendar_event',
      description: 'Add a calendar reminder, optionally associated with a camp.',
      parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' }, campId: { type: 'string' }, time: { type: 'string' } }, required: ['title', 'date'], additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_feeding_plan',
      description: 'Create a feeding plan for camps using feed items and dated schedules.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' }, campIds: { type: 'array', items: { type: 'string' } },
          feedItems: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', enum: ['lick', 'supplement', 'grazing', 'roughage', 'concentrate'] }, amountPerSheep: { type: 'string' } }, required: ['name', 'amountPerSheep'], additionalProperties: false } },
          schedule: { type: 'array', items: { type: 'object', properties: { itemIndex: { type: 'integer' }, startDate: { type: 'string' }, endDate: { type: 'string' }, frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'once', 'custom', 'every-3-days'] } }, required: ['itemIndex', 'startDate', 'frequency'], additionalProperties: false } }
        }, required: ['name', 'campIds', 'feedItems', 'schedule'], additionalProperties: false
      }
    }
  }
]

export async function GET() {
  return Response.json({ available: Boolean(process.env.OPENAI_API_KEY) })
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'AI mode is not configured.' }, { status: 503 })

  try {
    const { text, context } = await request.json()
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Translate farm instructions into one or more proposed farm function calls. Use only IDs and names provided in context. Never claim an action was executed. For missing details, do not guess; ask a brief follow-up in the response content.' },
          { role: 'user', content: `Farm context: ${JSON.stringify(context)}\nInstruction: ${text}` }
        ],
        tools: functions,
        tool_choice: 'auto'
      })
    })
    const result = await response.json()
    if (!response.ok) return Response.json({ error: result.error?.message || 'AI request failed.' }, { status: response.status })
    const message = result.choices?.[0]?.message
    const actions = (message?.tool_calls || []).map((call: any) => ({ name: call.function.name, arguments: JSON.parse(call.function.arguments) }))
    return Response.json({ actions, message: message?.content || '' })
  } catch {
    return Response.json({ error: 'Unable to parse the AI response.' }, { status: 400 })
  }
}

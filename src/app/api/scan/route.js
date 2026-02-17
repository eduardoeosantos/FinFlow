export async function POST(request) {
  try {
    const { image, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json(
        { error: 'API key não configurada. Vá em Configurações para adicionar.' },
        { status: 400 }
      );
    }

    if (!image) {
      return Response.json(
        { error: 'Nenhuma imagem enviada.' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: `Analise este recibo/cupom fiscal brasileiro. Extraia as informações e retorne APENAS um JSON válido no seguinte formato, sem nenhum texto adicional:
{"description":"nome do estabelecimento","amount":valor_numerico,"category":"alimentacao|transporte|moradia|saude|educacao|lazer|vestuario|servicos|investimentos|outros","date":"YYYY-MM-DD"}

Regras:
- "amount" deve ser o valor TOTAL da compra como número (ex: 45.90, não string)
- "category" deve ser uma das opções listadas acima
- "date" deve ser a data do recibo. Se não conseguir ler, use ${today}
- "description" deve ser o nome do estabelecimento ou descrição curta
- Retorne APENAS o JSON, sem markdown, sem explicações`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `Erro da API: ${response.status}`;
      
      if (response.status === 401) {
        return Response.json(
          { error: 'API Key inválida. Verifique em Configurações.' },
          { status: 401 }
        );
      }
      if (response.status === 429) {
        return Response.json(
          { error: 'Limite de requisições atingido. Aguarde um momento.' },
          { status: 429 }
        );
      }
      if (response.status === 403) {
        return Response.json(
          { error: 'Sem créditos na API. Adicione saldo em console.anthropic.com.' },
          { status: 403 }
        );
      }

      return Response.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON from response (handle markdown code blocks)
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.description || parsed.amount === undefined) {
      return Response.json(
        { error: 'Não foi possível extrair dados do recibo. Tente com outra foto.' },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      data: {
        description: parsed.description,
        amount: Math.abs(parseFloat(parsed.amount)),
        category: parsed.category || 'outros',
        date: parsed.date || today,
      },
    });
  } catch (error) {
    console.error('Scan error:', error);
    return Response.json(
      { error: 'Erro ao processar a imagem. Tente novamente.' },
      { status: 500 }
    );
  }
}

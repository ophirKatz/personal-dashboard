import { createClient } from 'npm:@supabase/supabase-js@2'
import { runTool, ToolError, type PdfTool } from './pdf-ops.ts'

const TOOLS: PdfTool[] = ['merge', 'split', 'extract', 'remove', 'rotate', 'images-to-pdf', 'watermark']
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_TOTAL_BYTES = 30 * 1024 * 1024

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  })
}

// Expects multipart/form-data: `tool`, one or more `files`, and optional
// `pages`, `angle`, `text`, `opacity`. Responds with the processed PDF (or a
// ZIP for split); errors are JSON `{ error, message }`.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'MISSING_CONFIG' }, 500)

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401)
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'UNAUTHORIZED' }, 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'INVALID_BODY', message: 'Expected multipart form data' }, 400)
  }

  const tool = form.get('tool')
  if (typeof tool !== 'string' || !TOOLS.includes(tool as PdfTool)) {
    return json({ error: 'INVALID_TOOL', message: 'Unknown tool' }, 400)
  }

  const uploads = form.getAll('files').filter((f): f is File => f instanceof File)
  let total = 0
  for (const f of uploads) {
    if (f.size > MAX_FILE_BYTES) return json({ error: 'FILE_TOO_LARGE', message: `"${f.name}" is over 15 MB` }, 413)
    total += f.size
  }
  if (total > MAX_TOTAL_BYTES) return json({ error: 'FILE_TOO_LARGE', message: 'Total upload is over 30 MB' }, 413)

  const str = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v : undefined }
  const num = (k: string) => { const v = str(k); return v === undefined || v === '' ? undefined : Number(v) }

  try {
    const files = await Promise.all(
      uploads.map(async f => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    )
    const result = await runTool(tool as PdfTool, files, {
      pages: str('pages'),
      angle: num('angle'),
      text: str('text'),
      opacity: num('opacity'),
    })
    return new Response(result.bytes, {
      status: 200,
      headers: { 'content-type': result.contentType, ...corsHeaders() },
    })
  } catch (err) {
    if (err instanceof ToolError) return json({ error: err.code, message: err.message }, 422)
    console.error('pdf-tools failed', err)
    return json({ error: 'PROCESSING_FAILED', message: 'Could not process that file' }, 500)
  }
})

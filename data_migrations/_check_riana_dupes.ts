import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
for (const line of fs.readFileSync('/Users/syawal/projects/internal-gangsehat/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: riana } = await supabase.from('patients').select('id').eq('no_rm','L5925109995').single()
  const { data } = await supabase.from('patient_visits')
    .select('id,visit_date,visit_time,service_type,created_at,package_id')
    .eq('patient_id', riana!.id).is('package_id', null)
  console.log(JSON.stringify(data, null, 2))
  const ids = (data??[]).map(v=>v.id)
  const { data: tx } = await supabase.from('transactions').select('id,visit_id,amount,description,created_at').in('visit_id', ids)
  console.log('transactions:', JSON.stringify(tx, null, 2))
}
main().catch(e=>{console.error(e);process.exit(1)})

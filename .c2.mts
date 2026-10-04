import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const one=async(id:string)=>(await sb.from('patient_visits').select('*').like('id' as any, id+'%').limit(1)).data
const {data:br}=await sb.from('branches').select('id').ilike('name','%Griya Anak%')
const {data:all}=await sb.from('patient_visits').select('id,patient_id,griya_slot_id,visit_date,visit_time,status,kehadiran,attending_staff_id').eq('branch_id',br![0].id)
for (const vid of ['9028968e','f8225383','2de5ffa5']) { const x=all!.find(v=>v.id.startsWith(vid))!
  console.log(vid,x.visit_date,JSON.stringify(all!.filter(v=>v.patient_id===x.patient_id&&v.visit_date===x.visit_date).map(v=>[v.id.slice(0,8),v.griya_slot_id?.slice(0,8),v.visit_time,v.kehadiran??v.status])))
}
const {data:dv}=await sb.from('patient_visits').select('id').eq('griya_slot_id','b4f8c388-fef4-4c4c-b22b-a25de68346ac')
for(const v of dv!) for(const t of ['transactions','session_notes','resume_links','terapi_awal_assessments']){const r=await sb.from(t).select('id',{count:'exact',head:true}).eq('visit_id',v.id);console.log('b4f8 visit',v.id.slice(0,8),t,r.count)}

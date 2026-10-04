import { createClient } from '@supabase/supabase-js'
import { createDecipheriv } from 'crypto'
import fs from 'fs'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const key=Buffer.from(process.env.ENCRYPTION_KEY!,'hex')
const dec=(t:string)=>{try{const [iv,tag,d]=t.split(':');const c=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'hex'));c.setAuthTag(Buffer.from(tag,'hex'));return c.update(d,'hex','utf8')+c.final('utf8')}catch{return t}}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const {data:br}=await sb.from('branches').select('id').ilike('name','%Griya Anak%'); const b=br![0].id
const {data:slots}=await sb.from('griya_schedule_slots').select('*').eq('branch_id',b)
const sm=Object.fromEntries(slots!.map(s=>[s.id,s]))
const {data:visits}=await sb.from('patient_visits').select('id,patient_id,griya_slot_id,attending_staff_id,visit_date,visit_time,status,kehadiran,notes,created_at').eq('branch_id',b).not('griya_slot_id','is',null)
const pids=[...new Set(slots!.map(s=>s.patient_id))]
const {data:pts}=await sb.from('patients').select('id,encrypted_name').in('id',pids)
const nm:any=Object.fromEntries(pts!.map(p=>[p.id,dec(p.encrypted_name)]))
const {data:profs}=await sb.from('internal_profiles').select('id,full_name'); const pn:any=Object.fromEntries(profs!.map(p=>[p.id,p.full_name]))
async function links(id:string){const o:any={};for(const t of ['transactions','session_notes','resume_links','terapi_awal_assessments']){const r=await sb.from(t).select('id',{count:'exact',head:true}).eq('visit_id',id);if(r.count)o[t]=r.count}
 for(const t of ['griya_medical_records','griya_rekam_medis']){const r=await sb.from(t).select('id',{count:'exact',head:true}).eq('visit_id',id);if(!r.error&&r.count)o[t]=r.count};return JSON.stringify(o)}
console.log('== visits outside their slot window')
for(const v of visits!){const s=sm[v.griya_slot_id];if(!s)continue;if(v.visit_date<s.start_date||(s.end_date&&v.visit_date>s.end_date))
 console.log(nm[v.patient_id],'|',v.id.slice(0,8),v.visit_date,v.visit_time,v.status,v.kehadiran,v.notes,'staff',pn[v.attending_staff_id],'| slot',s.id.slice(0,8),s.hari,s.slot_time,s.status,s.start_date,'→',s.end_date,'|',await links(v.id))}
console.log('== patients with >1 active slot same hari+discipline')
const g:any={};for(const s of slots!.filter(s=>s.status==='active')){(g[s.patient_id+s.hari+s.discipline]??=[]).push(s)}
for(const arr of Object.values(g) as any[]) if(arr.length>1){console.log('--',nm[arr[0].patient_id])
 for(const s of arr){const vs=visits!.filter(v=>v.griya_slot_id===s.id);console.log('  slot',s.id.slice(0,8),s.hari,s.slot_time,s.discipline,'pin',pn[s.therapist_id]??'-','start',s.start_date,'created',s.created_at.slice(0,16),'visits:',vs.map(v=>`${v.visit_date}:${v.kehadiran??v.status}`).join(' '))}
 const {data:logs}=await sb.from('activity_logs').select('created_at,action,resource_id,old_values,new_values').eq('patient_id',arr[0].patient_id).order('created_at');for(const l of logs!.slice(-12))console.log('   log',l.created_at.slice(0,16),l.action,l.resource_id?.slice(0,8),JSON.stringify(l.old_values),JSON.stringify(l.new_values))}

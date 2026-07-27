import { fetchPublicResume } from '@/app/actions/resumeLinks'
import { PATIENT_RESUME_STYLES, renderPatientResumeBody } from '@/lib/patientResumeStyles'

// Public, unauthenticated patient resume page — reachable via a token link
// staff share from Medical Records / the assessment page (see
// app/actions/resumeLinks.ts). Allowed through proxy.ts's isPublic check.
export default async function PatientResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await fetchPublicResume(token)

  if (!data) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PATIENT_RESUME_STYLES }} />
        <div className="not-found">
          <h1 style={{ fontSize: '16pt', color: '#1a4a76', marginBottom: 10 }}>Link Tidak Valid</h1>
          <p>Link resume ini tidak ditemukan atau sudah tidak berlaku. Silakan hubungi klinik untuk mendapatkan link baru.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PATIENT_RESUME_STYLES }} />
      <div dangerouslySetInnerHTML={{ __html: renderPatientResumeBody(data, true) }} />
    </>
  )
}

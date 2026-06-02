import Image from 'next/image'

export function MobileLogo() {
  return (
    <div className="flex justify-center mb-8 lg:hidden">
      <Image
        src="/black-logo.png"
        alt="Gang Sehat"
        width={160}
        height={46}
        style={{ height: 'auto' }}
        className="object-contain dark:hidden"
        priority
      />
      <Image
        src="/white-logo.png"
        alt="Gang Sehat"
        width={160}
        height={46}
        style={{ height: 'auto' }}
        className="object-contain hidden dark:block"
        priority
      />
    </div>
  )
}

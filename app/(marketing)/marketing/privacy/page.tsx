import Reveal from '@/components/marketing/Reveal'

export default function PrivacyPage() {
  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[720px]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
          Privacy
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
          Privacy notice
        </h1>
        <div className="mt-6 space-y-5 text-lg leading-8 text-slate-600">
          <p>
            Trailhead Holdings Ltd only uses the details you submit through this
            website to respond to your enquiry and manage relevant follow-up
            communication.
          </p>
          <p>
            We do not sell your data. If you would like us to update or delete
            information you have sent us, email rob@trailheadholdings.uk.
          </p>
        </div>
      </div>
    </Reveal>
  )
}

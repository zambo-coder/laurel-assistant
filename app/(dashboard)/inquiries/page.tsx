import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function InquiriesPage() {
  return (
    <div>
      <PageHeader title="Client Inquiries" description="Paste a client message and get a warm, professional response" />
      <Card>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — client inquiry handler</p>
      </Card>
    </div>
  )
}

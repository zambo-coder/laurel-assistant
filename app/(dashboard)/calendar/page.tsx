import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="Content Calendar" description="Generate a full month of Instagram post ideas" />
      <Card>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — 30-day content calendar</p>
      </Card>
    </div>
  )
}

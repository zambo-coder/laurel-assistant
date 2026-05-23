import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function ROIPage() {
  return (
    <div>
      <PageHeader title="ROI Tracker" description="Log time and outcomes to see where your effort pays off" />
      <Card>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — ROI & time tracker</p>
      </Card>
    </div>
  )
}

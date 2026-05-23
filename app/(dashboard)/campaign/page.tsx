import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function CampaignPage() {
  return (
    <div>
      <PageHeader title="Campaign Planner" description="Design a 2-week Instagram mini-campaign" />
      <Card>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — campaign planner</p>
      </Card>
    </div>
  )
}

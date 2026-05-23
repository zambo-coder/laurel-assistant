import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function AssetsPage() {
  return (
    <div>
      <PageHeader title="Asset Library" description="Your designs, suites, and reference files — all in one place" />
      <Card>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — asset library</p>
      </Card>
    </div>
  )
}

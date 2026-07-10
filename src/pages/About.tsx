import { ExternalLink, Database, Zap, Cloud } from 'lucide-react'

export default function About() {
  const links = [
    {
      title: 'Supabase Dashboard',
      description: 'Manage your database, authentication, and backend services.',
      url: 'https://supabase.com/dashboard/project/tjjvrqamitwtoslinrxy',
      icon: Database,
    },
    {
      title: 'Vercel Dashboard',
      description: 'View deployments, analytics, and manage your hosted application.',
      url: 'https://vercel.com/dashboard',
      icon: Zap,
    },
    {
      title: 'Google Cloud Console',
      description: 'Access your OAuth app configuration and other Google Cloud resources.',
      url: 'https://console.cloud.google.com',
      icon: Cloud,
    },
  ]

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">About</h1>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Project Links</h2>
      <div className="space-y-3">
        {links.map(({ title, description, url, icon: Icon }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium group-hover:text-primary transition-colors">{title}</p>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

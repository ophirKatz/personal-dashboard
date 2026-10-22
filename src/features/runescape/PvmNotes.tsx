import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { guideUrl } from './pvm'
import { PVM_GENERAL_INFO, PVM_LIMITED_LEARNING, PVM_NEXT_STEPS, PVM_RELATED_GUIDES } from './pvm-data'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-3.5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

/** The guide's reference sections that have no goals to tick off. */
export default function PvmNotes() {
  return (
    <div className="space-y-3">
      <Section title="How to use this path">
        {PVM_GENERAL_INFO.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title="Bosses with limited learning opportunities">
        <p>{PVM_LIMITED_LEARNING.blurb}</p>
        <ul className="flex flex-wrap gap-1.5">
          {PVM_LIMITED_LEARNING.bosses.map(name => (
            <li key={name} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{name}</li>
          ))}
        </ul>
      </Section>

      <Section title="Next steps">
        <p>{PVM_NEXT_STEPS.intro}</p>
        <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          {PVM_NEXT_STEPS.skills.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
        <p>{PVM_NEXT_STEPS.outro}</p>
      </Section>

      <Section title="Related PVME guides">
        <ul className="flex flex-col gap-1.5">
          {PVM_RELATED_GUIDES.map(g => (
            <li key={g.path}>
              <a href={guideUrl(g.path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {g.label} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

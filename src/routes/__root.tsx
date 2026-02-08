import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'
import { ThemeToggle } from '../lib/theme'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ring Count' },
      {
        name: 'description',
        content:
          "What's your ring count? See every championship your teams have won in your lifetime.",
      },
      { property: 'og:title', content: 'Ring Count' },
      {
        property: 'og:description',
        content: 'How many championships have your teams won in your lifetime?',
      },
      { property: 'og:image', content: 'https://ringcount.app/api/og' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
      },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))d.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="bg-surface text-text font-sans antialiased">
        <ThemeToggle />
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return <Outlet />
}

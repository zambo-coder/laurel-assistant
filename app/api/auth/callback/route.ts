import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const allowedEmail = process.env.ALLOWED_EMAIL
      if (allowedEmail && user.email !== allowedEmail) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }

      // Check if brand profile exists — redirect to onboarding if not
      const { data: profile } = await supabase
        .from('brand_profile')
        .select('id')
        .single()

      if (!profile) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      return NextResponse.redirect(`${origin}/captions`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

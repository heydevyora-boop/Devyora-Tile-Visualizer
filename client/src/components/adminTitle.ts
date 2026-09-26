import { createContext, useContext, useEffect } from 'react'

/**
 * Lets an admin page name itself in the shell's top bar when the route alone
 * cannot — the per-user page, which is titled after the person it is showing.
 * Every other page is named by its nav item and never touches this.
 *
 * Its own file so AdminShell.tsx exports nothing but a component, which is
 * what keeps fast refresh working for the shell.
 */
export const AdminTitleContext = createContext<(title: string | null) => void>(() => {})

export function useAdminTitle(title: string | null): void {
  const setTitle = useContext(AdminTitleContext)
  useEffect(() => {
    setTitle(title)
    // Cleared on the way out so the next page is never briefly titled after
    // the last one.
    return () => setTitle(null)
  }, [setTitle, title])
}

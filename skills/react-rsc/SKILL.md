---
name: react-rsc
description: Use when working with React Server Components — choosing between Server and Client components, designing the server/client boundary, debugging hydration mismatches, fetching data on the server, using Server Actions, optimizing initial load, or migrating from a Pages Router or pure client-side React app to App Router + RSC.
---

# React Server Components — pragmatic 2025 playbook

This skill captures the production patterns that work in real codebases. It's prescriptive on purpose. Deviate only with a stated reason.

## When to use this skill

- Picking between Server and Client component for a new piece of UI
- Designing or moving the server/client boundary
- Hitting a hydration mismatch
- Fetching data — async/await in components, caching, revalidation
- Building forms with Server Actions
- Migrating Pages Router → App Router
- Cutting JS bundle size on the critical path

## Iron law

**Server is the default. `"use client"` is the exception.**

If you can't articulate *why* a component must run on the client (it uses state, effects, browser APIs, or event handlers), it's a Server Component. This single discipline is responsible for 80% of the perf gap between RSC-savvy and RSC-naive codebases.

## The decision tree

```
Does it use useState, useEffect, useReducer, useContext (read), useRef, refs to DOM, event handlers, browser APIs (window, localStorage, etc.)?
├─ NO  → Server Component (no directive)
└─ YES → Client Component ("use client" at the TOP)
         └─ Push the boundary as far down the tree as possible.
            Server children of Client components are still server-rendered.
```

## Patterns

### 1. Push `"use client"` to the leaf

**Wrong:**
```tsx
"use client";  // ❌ entire page is now client-only

export default function Page() {
  return (
    <div>
      <Header />        {/* could be server */}
      <ProductList />   {/* could be server */}
      <CartButton />    {/* needs client */}
    </div>
  );
}
```

**Right:**
```tsx
// page.tsx — Server (no directive)
export default function Page() {
  return (
    <div>
      <Header />
      <ProductList />
      <CartButton />   {/* this one is "use client" inside its file */}
    </div>
  );
}
```

### 2. Pass server data as props, not via useEffect

**Wrong:**
```tsx
"use client";
function ProductList() {
  const [data, setData] = useState();
  useEffect(() => { fetch('/api/products').then(r => r.json()).then(setData); }, []);
  // double-fetch, layout shift, no SSR data
}
```

**Right:**
```tsx
// products/page.tsx — Server
export default async function Page() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

### 3. Server Actions for forms — not API routes

**Wrong:** dedicated `/api/contact` POST + client fetch + custom optimistic logic.

**Right:**
```tsx
// actions.ts
"use server";
export async function sendMessage(prev: State, formData: FormData) {
  const parsed = Schema.parse(Object.fromEntries(formData));
  await db.insert(parsed);
  revalidatePath('/inbox');
  return { ok: true };
}

// form.tsx — Client (only because of useFormState)
"use client";
import { useFormState } from 'react-dom';
import { sendMessage } from './actions';

export function Form() {
  const [state, action] = useFormState(sendMessage, { ok: null });
  return <form action={action}>...</form>;
}
```

### 4. Suspense + streaming for slow data

```tsx
// page.tsx — Server
export default function Page() {
  return (
    <>
      <Header />                           {/* ships immediately */}
      <Suspense fallback={<Skeleton />}>
        <SlowProducts />                   {/* streams when ready */}
      </Suspense>
    </>
  );
}

async function SlowProducts() {
  const products = await getProductsSlow(); // 800ms
  return <ProductList products={products} />;
}
```

## Anti-patterns

| Anti-pattern | Why it's wrong | Fix |
|---|---|---|
| `"use client"` at the top of `page.tsx` | Disables RSC for the whole route | Move client logic into a small leaf component |
| `useEffect` for initial data | Hydration delay, layout shift, no SSR | Server Component with `await` |
| Forms via `onSubmit` + `fetch('/api/...')` | Reinvents Server Actions, no progressive enhancement | Server Action + `useFormState` |
| Importing a Server-only library into a Client component | Build error or runtime failure | Wrap usage in a Server Component, pass results as props |
| `dynamic(() => import(...), { ssr: false })` everywhere | Defeats SSR + RSC entirely | Use Suspense + Server Component instead, only `ssr: false` for genuinely client-only libs (e.g., charts that read window) |
| Sharing modules between Server and Client without `import 'server-only'` | Server secrets can leak into client bundle | Use `import 'server-only'` at the top of any module that must never reach the client |

## Hydration mismatch — debugging cheatsheet

When you see "Hydration failed because the initial UI does not match what was rendered on the server":

1. **First suspect: `Date.now()`, `Math.random()`, or `new Date()` in render.** Move to `useEffect`, or compute on server and pass as prop.
2. **Second suspect: `typeof window !== 'undefined'` checks in render.** That's a code smell — split into Client component or use `useSyncExternalStore`.
3. **Third suspect: browser extensions** (Grammarly, dark mode extensions). Suppress with `suppressHydrationWarning` only after eliminating 1 and 2.
4. **Fourth suspect: malformed HTML** (e.g., `<p>` containing a `<div>`). The browser auto-corrects on parse; React doesn't. Run the page through W3C validator.

## Verification checklist

- [ ] No `"use client"` higher than necessary
- [ ] No `useEffect` for initial data fetching
- [ ] Forms use Server Actions where possible
- [ ] Slow data wrapped in `<Suspense>`
- [ ] No `Math.random()` / `Date.now()` in render
- [ ] No `typeof window` checks in render
- [ ] `import 'server-only'` on any server-secret module
- [ ] First-load JS budget under 100KB on critical pages
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms (verify with Lighthouse)

## When stuck

1. **Re-read this file from the top.** Most "RSC won't cooperate" issues are decision-tree violations.
2. **Read the component tree as a server/client diagram.** Color server components green, client red. Look for red branches that could be green.
3. **Look up the latest API behavior** via Context7 — RSC semantics are still evolving (especially around caching, `unstable_cache`, `revalidateTag`).
4. **Hand off to Cipher (Frontend Lead)** if the decision is architectural beyond a single feature.

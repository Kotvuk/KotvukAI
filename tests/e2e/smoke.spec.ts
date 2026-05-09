import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('loads and shows key content', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/KotvukAI/)
    await expect(page.getByRole('link', { name: /login|войти/i }).first()).toBeVisible()
  })

  test('has correct meta description', async ({ page }) => {
    await page.goto('/')
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc).toBeTruthy()
    expect(desc!.length).toBeGreaterThan(10)
  })
})

test.describe('Login page', () => {
  test('renders auth form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /kotvuk/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password|пароль/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|войти|кіру/i })).toBeVisible()
  })

  test('shows validation on empty submit', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /sign in|войти|кіру/i }).click()
    const emailInput = page.getByLabel(/email/i)
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)
    expect(validity).toBe(true)
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('test_invalid@example.com')
    await page.getByLabel(/password|пароль/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|войти|кіру/i }).click()
    await expect(page.locator('[class*="error"], [class*="err"], [role="alert"]').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Register page', () => {
  test('renders registration form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password|пароль/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /register|создать|тіркелу/i })).toBeVisible()
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/register')
    const loginLink = page.getByRole('link', { name: /sign in|войти|кіру/i })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Protected routes', () => {
  test('dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard'), { timeout: 8000 })
    expect(page.url()).not.toContain('/dashboard')
  })
})

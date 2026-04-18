async function main() {
  const signupResponse = await fetch('http://localhost:3002/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test-user@example.com', password: 'password123' }),
  });
  console.log('signup status', signupResponse.status);
  console.log('signup body', await signupResponse.text());
}

main().catch((err) => { console.error(err); process.exit(1) })

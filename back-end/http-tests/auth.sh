RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"victor.soares@viso.dev.br","password":"Admin@123456"}')

echo "=== FULL RESPONSE ==="
echo "$RESPONSE" | python3 -m json.tool

ACCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
REFRESH=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")

echo ""
echo "=== JWT HEADER ==="
echo "$ACCESS" | cut -d. -f1 | base64 -d 2>/dev/null | python3 -m json.tool

echo ""
echo "=== JWT PAYLOAD ==="
echo "$ACCESS" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool

echo ""
echo "=== REFRESH TOKEN (raw, first 40 chars) ==="
echo "${REFRESH:0:40}..."

echo ""
echo "=== TEST REFRESH ==="
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | python3 -m json.tool

echo ""
echo "=== TEST LOGOUT ==="
curl -si -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | head -3

echo ""
echo "=== TEST REFRESH AFTER LOGOUT (should fail) ==="
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | python3 -m json.tool
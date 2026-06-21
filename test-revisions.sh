#!/bin/bash
set -e

API="http://localhost:3001/api"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJlZGl0b3IwMSIsInJvbGUiOiJlZGl0b3IiLCJkaXNwbGF5TmFtZSI6Iui1hOa3see8lui-kSIsImlhdCI6MTc4MjAzMjg4NiwiZXhwIjoxNzgyNjM3Njg2fQ.ejsrfkhZLwCQJwyVNELRs8XUuDLmRTdHCzDkyaNnOp4"

echo "=== 1. 获取词条1当前信息 ==="
curl -s "$API/entries/1" | python3 -m json.tool

echo ""
echo "=== 2. 修改词条1的简介 ==="
curl -s -X PUT "$API/entries/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"summary":"中国古典四大名著之首，原名《石头记》，清代曹雪芹著，高鹗续。以贾、史、王、薛四大家族兴衰为背景。（已编辑测试）"}'

echo ""
echo "=== 3. 查看修订历史 ==="
curl -s "$API/revisions/entry/1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== 4. 修改版本1的描述 ==="
curl -s -X PUT "$API/versions/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"乾隆五十六年（1791）程伟元、高鹗整理刊刻的活字本，首次以活字排印一百二十回《红楼梦》。（测试修订）"}'

echo ""
echo "=== 5. 查看版本1的修订历史 ==="
curl -s "$API/revisions/version/1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== 测试完成 ==="

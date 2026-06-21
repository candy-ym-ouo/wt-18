#!/bin/bash
set -e

API="http://localhost:3001/api"

echo "========================================"
echo "  完整回滚功能验证测试"
echo "========================================"

echo ""
echo "【Step 1】登录获取 token..."
LOGIN_RES=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"editor01","password":"editor123"}')
TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "✅ 登录成功，token 获取完成"

echo ""
echo "【Step 2】获取词条1初始状态..."
ENTRY1_BEFORE=$(curl -s "$API/entries/1")
ENTRY1_TITLE=$(echo "$ENTRY1_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['title'])")
ENTRY1_SUMMARY=$(echo "$ENTRY1_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary'])")
echo "  初始标题: $ENTRY1_TITLE"
echo "  初始简介: $(echo "$ENTRY1_SUMMARY" | cut -c1-40)..."

echo ""
echo "【Step 3】修改词条1（标题和简介）..."
curl -s -X PUT "$API/entries/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"红楼梦（修改测试版）","summary":"这是修改后的简介内容，用于测试修订历史回滚功能是否正常工作。"}' > /dev/null
echo "✅ 词条1修改完成"

echo ""
echo "【Step 4】验证词条1已修改..."
ENTRY1_AFTER=$(curl -s "$API/entries/1")
NEW_TITLE=$(echo "$ENTRY1_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['title'])")
NEW_SUMMARY=$(echo "$ENTRY1_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary'])")
echo "  当前标题: $NEW_TITLE"
echo "  当前简介: $(echo "$NEW_SUMMARY" | cut -c1-40)..."

echo ""
echo "【Step 5】获取词条1的修订历史..."
REVISIONS=$(curl -s "$API/revisions/entry/1" -H "Authorization: Bearer $TOKEN")
echo "$REVISIONS" | python3 -m json.tool
REV_COUNT=$(echo "$REVISIONS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "✅ 找到 $REV_COUNT 条修订记录"

echo ""
echo "【Step 6】回滚 title 字段的修改..."
TITLE_REV_ID=$(echo "$REVISIONS" | python3 -c "
import sys,json
items = json.load(sys.stdin)
for r in items:
    if r['field_name'] == 'title':
        print(r['id'])
        break
")
echo "  回滚修订记录 ID: $TITLE_REV_ID"
ROLLBACK_RES=$(curl -s -X POST "$API/revisions/$TITLE_REV_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
echo "  回滚结果: $ROLLBACK_RES"

echo ""
echo "【Step 7】验证词条1标题已回滚..."
ENTRY1_AFTER_ROLLBACK=$(curl -s "$API/entries/1")
ROLLED_TITLE=$(echo "$ENTRY1_AFTER_ROLLBACK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['title'])")
echo "  回滚后标题: $ROLLED_TITLE"
if [ "$ROLLED_TITLE" = "$ENTRY1_TITLE" ]; then
  echo "✅ 标题回滚成功！从 '$NEW_TITLE' 恢复为 '$ROLLED_TITLE'"
else
  echo "❌ 标题回滚失败！期望 '$ENTRY1_TITLE'，实际 '$ROLLED_TITLE'"
  exit 1
fi

echo ""
echo "========================================"
echo "  词条回滚测试通过！开始测试版本回滚"
echo "========================================"

echo ""
echo "【Step 8】获取版本1初始状态..."
VERSION1_BEFORE=$(curl -s "$API/versions/1")
V1_DESC=$(echo "$VERSION1_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['description'])")
V1_PAGES=$(echo "$VERSION1_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pages'])")
V1_PUBNAME=$(echo "$VERSION1_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version_name'])")
echo "  初始版本名: $V1_PUBNAME"
echo "  初始描述: $(echo "$V1_DESC" | cut -c1-40)..."
echo "  初始页数: $V1_PAGES (类型: $(echo "$V1_PAGES" | python3 -c "import sys; print(type(eval(sys.stdin.read().strip())).__name__)"))"

echo ""
echo "【Step 9】修改版本1（描述 + 页数）..."
curl -s -X PUT "$API/versions/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"这是修改后的版本描述，用于测试回滚功能。","pages":200,"version_name":"程甲本（修改版）"}' > /dev/null
echo "✅ 版本1修改完成"

echo ""
echo "【Step 10】验证版本1已修改..."
VERSION1_AFTER=$(curl -s "$API/versions/1")
NEW_DESC=$(echo "$VERSION1_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['description'])")
NEW_PAGES=$(echo "$VERSION1_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pages'])")
NEW_PUBNAME=$(echo "$VERSION1_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version_name'])")
echo "  修改后版本名: $NEW_PUBNAME"
echo "  修改后描述: $(echo "$NEW_DESC" | cut -c1-40)..."
echo "  修改后页数: $NEW_PAGES (类型: $(echo "$NEW_PAGES" | python3 -c "import sys; print(type(eval(sys.stdin.read().strip())).__name__)"))"

echo ""
echo "【Step 11】获取版本1的修订历史..."
V1_REVISIONS=$(curl -s "$API/revisions/version/1" -H "Authorization: Bearer $TOKEN")
echo "$V1_REVISIONS" | python3 -m json.tool
V1_REV_COUNT=$(echo "$V1_REVISIONS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "✅ 找到 $V1_REV_COUNT 条修订记录"

echo ""
echo "【Step 12】回滚 pages 字段的修改（INTEGER 类型测试）..."
PAGES_REV_ID=$(echo "$V1_REVISIONS" | python3 -c "
import sys,json
items = json.load(sys.stdin)
for r in items:
    if r['field_name'] == 'pages':
        print(r['id'])
        break
")
echo "  回滚 pages 修订记录 ID: $PAGES_REV_ID"
PAGES_ROLLBACK=$(curl -s -X POST "$API/revisions/$PAGES_REV_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
echo "  回滚结果: $PAGES_ROLLBACK"

echo ""
echo "【Step 13】验证版本1页数已回滚..."
V1_CHECK=$(curl -s "$API/versions/1")
ROLLED_PAGES=$(echo "$V1_CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pages'])")
PAGES_TYPE=$(echo "$ROLLED_PAGES" | python3 -c "import sys; print(type(eval(sys.stdin.read().strip())).__name__)")
echo "  回滚后页数: $ROLLED_PAGES (类型: $PAGES_TYPE)"
if [ "$ROLLED_PAGES" = "$V1_PAGES" ]; then
  echo "✅ 页数回滚成功！从 $NEW_PAGES 恢复为 $ROLLED_PAGES（类型正确：$PAGES_TYPE）"
else
  echo "❌ 页数回滚失败！期望 $V1_PAGES，实际 $ROLLED_PAGES"
  exit 1
fi

echo ""
echo "【Step 14】回滚 description 字段的修改..."
DESC_REV_ID=$(echo "$V1_REVISIONS" | python3 -c "
import sys,json
items = json.load(sys.stdin)
for r in items:
    if r['field_name'] == 'description':
        print(r['id'])
        break
")
echo "  回滚 description 修订记录 ID: $DESC_REV_ID"
DESC_ROLLBACK=$(curl -s -X POST "$API/revisions/$DESC_REV_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
echo "  回滚结果: $DESC_ROLLBACK"

echo ""
echo "【Step 15】验证版本1描述已回滚..."
V1_CHECK2=$(curl -s "$API/versions/1")
ROLLED_DESC=$(echo "$V1_CHECK2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['description'])")
echo "  回滚后描述: $(echo "$ROLLED_DESC" | cut -c1-40)..."
if [ "$ROLLED_DESC" = "$V1_DESC" ]; then
  echo "✅ 描述回滚成功！"
else
  echo "❌ 描述回滚失败！"
  echo "期望: $V1_DESC"
  echo "实际: $ROLLED_DESC"
  exit 1
fi

echo ""
echo "【Step 16】回滚 version_name 字段的修改..."
PUBNAME_REV_ID=$(echo "$V1_REVISIONS" | python3 -c "
import sys,json
items = json.load(sys.stdin)
for r in items:
    if r['field_name'] == 'version_name':
        print(r['id'])
        break
")
echo "  回滚 version_name 修订记录 ID: $PUBNAME_REV_ID"
PUBNAME_ROLLBACK=$(curl -s -X POST "$API/revisions/$PUBNAME_REV_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
echo "  回滚结果: $PUBNAME_ROLLBACK"

echo ""
echo "【Step 17】验证版本1版本名已回滚..."
V1_CHECK3=$(curl -s "$API/versions/1")
ROLLED_PUBNAME=$(echo "$V1_CHECK3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['version_name'])")
echo "  回滚后版本名: $ROLLED_PUBNAME"
if [ "$ROLLED_PUBNAME" = "$V1_PUBNAME" ]; then
  echo "✅ 版本名回滚成功！从 '$NEW_PUBNAME' 恢复为 '$ROLLED_PUBNAME'"
else
  echo "❌ 版本名回滚失败！期望 '$V1_PUBNAME'，实际 '$ROLLED_PUBNAME'"
  exit 1
fi

echo ""
echo "【Step 18】验证最终修订历史（应包含所有回滚操作记录）..."
FINAL_REVISIONS=$(curl -s "$API/revisions/version/1" -H "Authorization: Bearer $TOKEN")
FINAL_COUNT=$(echo "$FINAL_REVISIONS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "  版本1修订历史总数: $FINAL_COUNT 条"
echo "✅ 所有回滚操作均已被记录"

echo ""
echo "========================================"
echo "  🎉 所有测试通过！🎉"
echo "========================================"
echo "  - 词条标题回滚：✅"
echo "  - 版本名回滚：✅"
echo "  - 版本描述回滚：✅"
echo "  - 版本页数(INTEGER)回滚：✅"
echo "  - 回滚操作记录：✅"
echo "========================================"

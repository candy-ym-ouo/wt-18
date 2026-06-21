<template>
  <div>
    <h1 class="page-title">后台编辑管理</h1>

    <div class="stats-grid">
      <div class="stat-card"><div class="num">{{ stats.entries }}</div><div class="label">词条数</div></div>
      <div class="stat-card"><div class="num">{{ stats.versions }}</div><div class="label">版本数</div></div>
      <div class="stat-card"><div class="num">{{ stats.images }}</div><div class="label">图片数</div></div>
      <div class="stat-card"><div class="num">{{ stats.annotations }}</div><div class="label">批注数</div></div>
      <div class="stat-card"><div class="num">{{ stats.references }}</div><div class="label">引用数</div></div>
      <div class="stat-card"><div class="num">{{ stats.users || 0 }}</div><div class="label">学者数</div></div>
      <div class="stat-card"><div class="num">{{ stats.topics || 0 }}</div><div class="label">专题数</div></div>
      <div class="stat-card"><div class="num">{{ stats.chapters || 0 }}</div><div class="label">章节数</div></div>
      <div class="stat-card" :class="{ 'pending-alert': stats.pendingSubmissions > 0 }">
        <div class="num">{{ stats.pendingSubmissions || 0 }}</div>
        <div class="label">待审核征集</div>
      </div>
      <div class="stat-card"><div class="num">{{ stats.submissions || 0 }}</div><div class="label">总征集数</div></div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <button :class="['btn', tab==='entries'?'':'secondary']" @click="tab='entries'">词条管理</button>
      <button :class="['btn', tab==='versions'?'':'secondary']" @click="tab='versions'">版本管理</button>
      <button :class="['btn', tab==='refs'?'':'secondary']" @click="tab='refs'">引用关系</button>
      <button :class="['btn', tab==='topics'?'':'secondary']" @click="tab='topics'">专题专栏</button>
      <button :class="['btn', tab==='submissions'?'':'secondary']" @click="tab='submissions'">
        版本征集
        <span v-if="stats.pendingSubmissions > 0" class="badge">{{ stats.pendingSubmissions }}</span>
      </button>
      <button v-if="userStore.isAdmin || canManageUsers" :class="['btn', tab==='users'?'':'secondary']" @click="tab='users'">学者管理</button>
    </div>

    <div v-if="tab==='entries'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">词条列表</h3>
        <button class="btn sm" @click="openEntryModal()">+ 新建词条</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>书名</th><th>作者</th><th>朝代</th><th>版本数</th><th>引用数</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="e in entries" :key="e.id">
            <td>{{ e.id }}</td>
            <td><strong>{{ e.title }}</strong></td>
            <td>{{ e.author || '-' }}</td>
            <td>{{ e.dynasty || '-' }}</td>
            <td>{{ e.version_count }}</td>
            <td>{{ e.ref_count }}</td>
            <td class="meta">{{ e.updated_at }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openEntryModal(e)">编辑</button>
                <button class="btn sm danger" @click="delEntry(e)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='versions'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">版本列表</h3>
        <button class="btn sm" @click="openVersionModal()">+ 新建版本</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>所属词条</th><th>版本名</th><th>出版者</th><th>年代</th><th>页数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="v in versions" :key="v.id">
            <td>{{ v.id }}</td>
            <td>{{ v.entry_title }}</td>
            <td><strong>{{ v.version_name }}</strong></td>
            <td>{{ v.publisher || '-' }}</td>
            <td>{{ v.pub_year || '-' }}</td>
            <td>{{ v.pages || '-' }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openVersionModal(v)">编辑</button>
                <button class="btn sm danger" @click="delVersion(v)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='refs'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">引用关系</h3>
        <button class="btn sm" @click="openRefModal()">+ 新建关系</button>
      </div>
      <table>
        <thead><tr><th>源词条</th><th>关系</th><th>目标词条</th><th>说明</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="r in allRefs" :key="r.id">
            <td>{{ r.from_title || '(加载中)' }}</td>
            <td><span class="ref-type">{{ r.relation_type }}</span></td>
            <td>{{ r.to_title || '(加载中)' }}</td>
            <td class="meta">{{ r.note || '-' }}</td>
            <td><button class="btn sm danger" @click="delRef(r)">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='users'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 style="color:var(--primary-dark);">学者账号管理</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <input v-model="userSearch" placeholder="搜索用户名/邮箱..." style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" />
          <button v-if="canCreateUser" class="btn sm" @click="openUserModal()">+ 新建学者</button>
        </div>
      </div>
      <table>
        <thead><tr><th>ID</th><th>用户名</th><th>显示名</th><th>邮箱</th><th>角色</th><th>状态</th><th>最近登录</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in filteredUsers" :key="u.id">
            <td>{{ u.id }}</td>
            <td><strong>{{ u.username }}</strong></td>
            <td>{{ u.displayName || '-' }}</td>
            <td class="meta">{{ u.email || '-' }}</td>
            <td><span class="role-tag" :class="roleTagClass(u.role)">{{ roleLabel(u.role) }}</span></td>
            <td>
              <span class="status-tag" :class="u.status === 'active' ? 'status-active' : 'status-disabled'">
                {{ u.status === 'active' ? '正常' : '已禁用' }}
              </span>
            </td>
            <td class="meta">{{ u.last_login_at || '-' }}</td>
            <td class="meta">{{ u.created_at }}</td>
            <td>
              <div class="actions">
                <button v-if="userStore.canEditUser(u)" class="btn sm secondary" @click="openUserModal(u)">编辑</button>
                <button v-if="userStore.canEditUser(u) && u.id !== userStore.user.id" class="btn sm" :class="u.status==='active' ? 'warning' : 'success'" @click="toggleUserStatus(u)">
                  {{ u.status === 'active' ? '禁用' : '恢复' }}
                </button>
                <button v-if="userStore.canEditUser(u)" class="btn sm secondary" @click="openResetPwdModal(u)">重置密码</button>
                <button v-if="userStore.canEditUser(u) && u.id !== userStore.user.id" class="btn sm danger" @click="delUser(u)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredUsers.length === 0" style="padding:30px;text-align:center;color:#999;">
        暂无匹配的学者账号
      </div>
    </div>

    <div v-if="tab==='topics'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 style="color:var(--primary-dark);">专题考据专栏</h3>
        <button class="btn sm" @click="openTopicModal()">+ 新建专题</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>标题</th><th>作者</th><th>状态</th><th>章节数</th><th>词条数</th><th>排序</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="t in topics" :key="t.id">
            <td>{{ t.id }}</td>
            <td><strong>{{ t.title }}</strong><div v-if="t.subtitle" class="meta" style="font-size:12px;">{{ t.subtitle }}</div></td>
            <td>{{ t.author || '-' }}</td>
            <td><span :class="['status-tag', t.status==='published'?'status-active':'status-disabled']">{{ t.status==='published'?'已发布':'草稿' }}</span></td>
            <td>{{ t.chapter_count }}</td>
            <td>{{ t.entry_count }}</td>
            <td>{{ t.sort_order }}</td>
            <td class="meta">{{ t.updated_at }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openTopicModal(t)">编辑</button>
                <button class="btn sm secondary" @click="editTopicChapters(t)">章节</button>
                <button class="btn sm secondary" @click="editTopicEntries(t)">词条</button>
                <button class="btn sm danger" @click="delTopic(t)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="topics.length === 0" style="padding:30px;text-align:center;color:#999;">暂无专题</div>
    </div>

    <div v-if="tab==='submissions'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 style="color:var(--primary-dark);">版本征集审核</h3>
        <div style="display:flex;gap:8px;">
          <select v-model="submissionFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" @change="loadSubmissions">
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
      </div>
      <table>
        <thead><tr><th>ID</th><th>词条/书名</th><th>版本名</th><th>提交人</th><th>状态</th><th>图片</th><th>提交时间</th><th>审核人</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="s in submissions" :key="s.id">
            <td>{{ s.id }}</td>
            <td><strong>{{ s.entry_title || '（新建）' }}</strong><div v-if="s.entry_author" class="meta" style="font-size:12px;">{{ s.entry_author }}</div></td>
            <td>{{ s.version_name }}</td>
            <td>{{ s.submitter_name }}</td>
            <td><span :class="['status-tag', submissionStatusClass(s.status)]">{{ submissionStatusLabel(s.status) }}</span></td>
            <td>{{ s.image_count || 0 }}</td>
            <td class="meta">{{ s.created_at }}</td>
            <td>{{ s.reviewer_display_name || s.reviewer_name || '-' }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="viewSubmissionDetail(s)">查看</button>
                <button v-if="s.status === 'pending'" class="btn sm" @click="openReviewModal(s, 'approve')">通过</button>
                <button v-if="s.status === 'pending'" class="btn sm danger" @click="openReviewModal(s, 'reject')">拒绝</button>
                <button class="btn sm danger" @click="delSubmission(s)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="submissions.length === 0" style="padding:30px;text-align:center;color:#999;">暂无征集记录</div>
    </div>

    <div v-if="showSubmissionDetail" class="modal-overlay" @click.self="showSubmissionDetail=false">
      <div class="modal detail-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3>征集详情</h3>
          <div style="display:flex;gap:8px;">
            <button v-if="currentSubmission?.status === 'pending'" class="btn sm" @click="openReviewModal(currentSubmission, 'approve')">通过</button>
            <button v-if="currentSubmission?.status === 'pending'" class="btn sm danger" @click="openReviewModal(currentSubmission, 'reject')">拒绝</button>
            <button class="btn sm secondary" @click="showSubmissionDetail=false">关闭</button>
          </div>
        </div>
        <div v-if="currentSubmission">
          <div class="detail-row">
            <span class="label">提交编号：</span>
            <span>#{{ currentSubmission.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">提交时间：</span>
            <span>{{ currentSubmission.created_at }}</span>
          </div>
          <div class="detail-row">
            <span class="label">状态：</span>
            <span :class="['status-tag', submissionStatusClass(currentSubmission.status)]">{{ submissionStatusLabel(currentSubmission.status) }}</span>
          </div>
          <div class="detail-section">
            <h4>词条信息</h4>
            <div class="detail-row"><span class="label">关联词条：</span><span>{{ currentSubmission.entry_title || '（新建）' }}</span></div>
            <div v-if="currentSubmission.entry_author" class="detail-row"><span class="label">作者：</span><span>{{ currentSubmission.entry_author }}</span></div>
          </div>
          <div class="detail-section">
            <h4>版本信息</h4>
            <div class="detail-row"><span class="label">版本名：</span><span>{{ currentSubmission.version_name }}</span></div>
            <div class="detail-row"><span class="label">出版者：</span><span>{{ currentSubmission.publisher || '-' }}</span></div>
            <div class="detail-row"><span class="label">年代：</span><span>{{ currentSubmission.pub_year || '-' }}</span></div>
            <div class="detail-row"><span class="label">页数：</span><span>{{ currentSubmission.pages || '-' }}</span></div>
            <div v-if="currentSubmission.isbn" class="detail-row"><span class="label">ISBN：</span><span>{{ currentSubmission.isbn }}</span></div>
            <div v-if="currentSubmission.description" class="detail-row"><span class="label">说明：</span><span>{{ currentSubmission.description }}</span></div>
          </div>
          <div class="detail-section">
            <h4>提交人信息</h4>
            <div class="detail-row"><span class="label">姓名：</span><span>{{ currentSubmission.submitter_name }}</span></div>
            <div v-if="currentSubmission.submitter_contact" class="detail-row"><span class="label">联系方式：</span><span>{{ currentSubmission.submitter_contact }}</span></div>
            <div v-if="currentSubmission.submitter_note" class="detail-row"><span class="label">备注：</span><span>{{ currentSubmission.submitter_note }}</span></div>
          </div>
          <div v-if="currentSubmission.images && currentSubmission.images.length > 0" class="detail-section">
            <h4>书影图片</h4>
            <div class="detail-images">
              <div v-for="img in currentSubmission.images" :key="img.id" class="detail-image-item">
                <img :src="'/uploads/' + img.filename" :alt="img.caption" @click="previewImage('/uploads/' + img.filename)" />
                <div v-if="img.caption" class="image-caption-text">{{ img.caption }}</div>
              </div>
            </div>
          </div>
          <div v-if="currentSubmission.review_note" class="detail-section">
            <h4>审核信息</h4>
            <div class="detail-row"><span class="label">审核人：</span><span>{{ currentSubmission.reviewer_display_name || currentSubmission.reviewer_name || '-' }}</span></div>
            <div class="detail-row"><span class="label">审核时间：</span><span>{{ currentSubmission.reviewed_at || '-' }}</span></div>
            <div class="detail-row"><span class="label">审核说明：</span><span>{{ currentSubmission.review_note }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal=false">
      <div class="modal sm-modal">
        <h3>{{ reviewAction === 'approve' ? '审核通过' : '拒绝提交' }}</h3>
        <p v-if="reviewAction === 'approve'" style="color:#666;font-size:13px;">
          确认通过「<strong>{{ reviewSubmission?.version_name }}</strong>」的征集？
          通过后将创建正式版本。
        </p>
        <p v-else style="color:#666;font-size:13px;">
          确认拒绝「<strong>{{ reviewSubmission?.version_name }}</strong>」的征集？
        </p>

        <div v-if="reviewAction === 'approve' && !reviewSubmission?.entry_id" class="form-group">
          <label>词条处理方式</label>
          <div style="display:flex;gap:16px;margin:8px 0;">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="radio" v-model="reviewForm.create_new_entry" :value="true" />
              <span>创建新词条</span>
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="radio" v-model="reviewForm.create_new_entry" :value="false" />
              <span>选择已有词条</span>
            </label>
          </div>
          <div v-if="reviewForm.create_new_entry" class="grid cols-2">
            <div class="form-group">
              <label>书名 *</label>
              <input v-model="reviewForm.entry_title" />
            </div>
            <div class="form-group">
              <label>作者</label>
              <input v-model="reviewForm.entry_author" />
            </div>
          </div>
          <div v-else class="form-group">
            <label>选择词条 *</label>
            <select v-model="reviewForm.entry_id">
              <option :value="null">-- 请选择 --</option>
              <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>审核说明（选填）</label>
          <textarea v-model="reviewForm.review_note" rows="3" placeholder="请输入审核说明..."></textarea>
        </div>

        <p v-if="reviewError" style="color:#dc2626;font-size:13px;">{{ reviewError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showReviewModal=false">取消</button>
          <button class="btn" :class="reviewAction === 'reject' ? 'danger' : ''" @click="submitReview" :disabled="reviewLoading">
            {{ reviewLoading ? '提交中...' : (reviewAction === 'approve' ? '确认通过' : '确认拒绝') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="imagePreview" class="modal-overlay" @click.self="imagePreview=null">
      <div class="image-preview-modal" @click.self="imagePreview=null">
        <img :src="imagePreview" alt="预览" />
        <button class="close-preview" @click="imagePreview=null">×</button>
      </div>
    </div>

    <div v-if="showChapterEditor" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div>
          <button class="btn sm secondary" @click="showChapterEditor=false">← 返回专题列表</button>
          <span style="margin-left:12px;font-size:16px;font-weight:bold;color:var(--primary-dark);">{{ currentTopic?.title }} - 章节目录</span>
        </div>
        <button class="btn sm" @click="openChapterModal()">+ 新建章节</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>标题</th><th>副标题</th><th>状态</th><th>词条数</th><th>排序</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="c in chapters" :key="c.id">
            <td>{{ c.id }}</td>
            <td><strong>{{ c.title }}</strong></td>
            <td>{{ c.subtitle || '-' }}</td>
            <td><span :class="['status-tag', c.status==='published'?'status-active':'status-disabled']">{{ c.status==='published'?'已发布':'草稿' }}</span></td>
            <td>{{ c.entry_count }}</td>
            <td>{{ c.sort_order }}</td>
            <td class="meta">{{ c.updated_at }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openChapterModal(c)">编辑</button>
                <button class="btn sm secondary" @click="editChapterEntries(c)">词条</button>
                <button class="btn sm danger" @click="delChapter(c)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="chapters.length === 0" style="padding:30px;text-align:center;color:#999;">暂无章节</div>

      <div v-if="showChapterEntries" class="card" style="margin-top:16px;background:#fffdf8;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h4 style="color:var(--primary-dark);">「{{ currentChapter?.title }}」关联词条</h4>
          <button class="btn sm" @click="openTopicEntryModal('chapter')">+ 挂接词条</button>
        </div>
        <table>
          <thead><tr><th>词条名</th><th>备注说明</th><th>排序</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="te in chapterEntries" :key="te.id">
              <td><strong>{{ te.entry_title }}</strong></td>
              <td class="meta">{{ te.note || '-' }}</td>
              <td>{{ te.sort_order }}</td>
              <td>
                <div class="actions">
                  <button class="btn sm secondary" @click="openTopicEntryModal('chapter', te)">编辑</button>
                  <button class="btn sm danger" @click="delTopicEntry(te)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="chapterEntries.length === 0" style="padding:20px;text-align:center;color:#999;">暂无挂接词条</div>
      </div>
    </div>

    <div v-if="showTopicEntries" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div>
          <button class="btn sm secondary" @click="showTopicEntries=false">← 返回专题列表</button>
          <span style="margin-left:12px;font-size:16px;font-weight:bold;color:var(--primary-dark);">{{ currentTopic?.title }} - 专题关联词条</span>
        </div>
        <button class="btn sm" @click="openTopicEntryModal('topic')">+ 挂接词条</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>词条名</th><th>备注说明</th><th>排序</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="te in topicEntries" :key="te.id">
            <td>{{ te.id }}</td>
            <td><strong>{{ te.entry_title }}</strong></td>
            <td class="meta">{{ te.note || '-' }}</td>
            <td>{{ te.sort_order }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openTopicEntryModal('topic', te)">编辑</button>
                <button class="btn sm danger" @click="delTopicEntry(te)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="topicEntries.length === 0" style="padding:30px;text-align:center;color:#999;">暂无挂接词条</div>
    </div>

    <div v-if="showEntryModal" class="modal-overlay" @click.self="showEntryModal=false">
      <div class="modal">
        <h3>{{ editingEntry.id ? '编辑词条' : '新建词条' }}</h3>
        <div class="form-group">
          <label>书名 *</label>
          <input v-model="editingEntry.title" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="editingEntry.author" />
        </div>
        <div class="form-group">
          <label>朝代/时代</label>
          <input v-model="editingEntry.dynasty" placeholder="如：清代、明代" />
        </div>
        <div class="form-group">
          <label>封面 URL</label>
          <input v-model="editingEntry.cover_url" placeholder="图片链接" />
        </div>
        <div class="form-group">
          <label>内容简介</label>
          <textarea v-model="editingEntry.summary"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showEntryModal=false">取消</button>
          <button class="btn" @click="saveEntry">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showVersionModal" class="modal-overlay" @click.self="showVersionModal=false">
      <div class="modal">
        <h3>{{ editingVersion.id ? '编辑版本' : '新建版本' }}</h3>
        <div class="form-group">
          <label>所属词条 *</label>
          <select v-model="editingVersion.entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>版本名 *</label>
          <input v-model="editingVersion.version_name" placeholder="如：庚辰本、程甲本" />
        </div>
        <div class="form-group">
          <label>出版者</label>
          <input v-model="editingVersion.publisher" />
        </div>
        <div class="form-group">
          <label>刊刻/出版年代</label>
          <input v-model="editingVersion.pub_year" placeholder="如：1791、乾隆五十六年" />
        </div>
        <div class="form-group">
          <label>回数/页数</label>
          <input type="number" v-model.number="editingVersion.pages" />
        </div>
        <div class="form-group">
          <label>ISBN</label>
          <input v-model="editingVersion.isbn" />
        </div>
        <div class="form-group">
          <label>版本说明</label>
          <textarea v-model="editingVersion.description"></textarea>
        </div>
        <div class="form-group">
          <label>全文录入（选填）</label>
          <textarea v-model="editingVersion.full_text" style="min-height:120px;"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showVersionModal=false">取消</button>
          <button class="btn" @click="saveVersion">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showRefModal" class="modal-overlay" @click.self="showRefModal=false">
      <div class="modal">
        <h3>新建引用关系</h3>
        <div class="form-group">
          <label>源词条（引用者）*</label>
          <select v-model="newRef.from_entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>关系类型 *</label>
          <select v-model="newRef.relation_type">
            <option value="异名">异名</option>
            <option value="承袭">承袭</option>
            <option value="相关">相关</option>
          </select>
        </div>
        <div class="form-group">
          <label>目标词条（被引用者）*</label>
          <select v-model="newRef.to_entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>说明</label>
          <textarea v-model="newRef.note"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showRefModal=false">取消</button>
          <button class="btn" @click="saveRef">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showUserModal" class="modal-overlay" @click.self="showUserModal=false">
      <div class="modal">
        <h3>{{ editingUser.id ? '编辑学者' : '新建学者' }}</h3>
        <div class="form-group">
          <label>用户名 *</label>
          <input v-model="editingUser.username" :disabled="!!editingUser.id" :style="editingUser.id ? {background:'#f5f5f5'} : {}" />
        </div>
        <div v-if="!editingUser.id" class="form-group">
          <label>初始密码 *</label>
          <input v-model="editingUser.password" type="password" placeholder="至少6位" />
        </div>
        <div class="form-group">
          <label>显示名</label>
          <input v-model="editingUser.displayName" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="editingUser.email" type="email" />
        </div>
        <div class="form-group">
          <label>角色</label>
          <select v-model="editingUser.role">
            <option v-for="r in assignableRoles" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div v-if="editingUser.id" class="form-group">
          <label>状态</label>
          <select v-model="editingUser.status">
            <option value="active">正常</option>
            <option value="disabled">已禁用</option>
          </select>
        </div>
        <p v-if="userError" style="color:#dc2626;font-size:13px;">{{ userError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showUserModal=false">取消</button>
          <button class="btn" @click="saveUser">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showResetPwdModal" class="modal-overlay" @click.self="showResetPwdModal=false">
      <div class="modal sm-modal">
        <h3>重置学者密码</h3>
        <p style="color:#666;font-size:13px;">为「<strong>{{ resetPwdUser?.username }}</strong>」设置新密码：</p>
        <div class="form-group">
          <label>新密码 *</label>
          <input v-model="resetPwdForm.newPassword" type="password" placeholder="至少6位" />
        </div>
        <div class="form-group">
          <label>确认新密码 *</label>
          <input v-model="resetPwdForm.confirmPassword" type="password" />
        </div>
        <p v-if="resetPwdError" style="color:#dc2626;font-size:13px;">{{ resetPwdError }}</p>
        <p v-if="resetPwdSuccess" style="color:#15803d;font-size:13px;">{{ resetPwdSuccess }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showResetPwdModal=false">取消</button>
          <button class="btn" @click="submitResetPwd" :disabled="resetPwdLoading">
            {{ resetPwdLoading ? '提交中...' : '重置密码' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showTopicModal" class="modal-overlay" @click.self="showTopicModal=false">
      <div class="modal">
        <h3>{{ editingTopic.id ? '编辑专题' : '新建专题' }}</h3>
        <div class="form-group">
          <label>专题标题 *</label>
          <input v-model="editingTopic.title" />
        </div>
        <div class="form-group">
          <label>副标题</label>
          <input v-model="editingTopic.subtitle" />
        </div>
        <div class="form-group">
          <label>作者/考据者</label>
          <input v-model="editingTopic.author" />
        </div>
        <div class="form-group">
          <label>封面 URL</label>
          <input v-model="editingTopic.cover_url" />
        </div>
        <div class="form-group">
          <label>专题简介</label>
          <textarea v-model="editingTopic.summary"></textarea>
        </div>
        <div class="grid cols-2">
          <div class="form-group">
            <label>状态</label>
            <select v-model="editingTopic.status">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </div>
          <div class="form-group">
            <label>排序（数字越小越靠前）</label>
            <input type="number" v-model.number="editingTopic.sort_order" />
          </div>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showTopicModal=false">取消</button>
          <button class="btn" @click="saveTopic">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showChapterModal" class="modal-overlay" @click.self="showChapterModal=false">
      <div class="modal">
        <h3>{{ editingChapter.id ? '编辑章节' : '新建章节' }}</h3>
        <div class="form-group">
          <label>章节标题 *</label>
          <input v-model="editingChapter.title" />
        </div>
        <div class="form-group">
          <label>副标题</label>
          <input v-model="editingChapter.subtitle" />
        </div>
        <div class="form-group">
          <label>章节内容</label>
          <textarea v-model="editingChapter.content" style="min-height:160px;"></textarea>
        </div>
        <div class="grid cols-2">
          <div class="form-group">
            <label>状态</label>
            <select v-model="editingChapter.status">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </div>
          <div class="form-group">
            <label>排序</label>
            <input type="number" v-model.number="editingChapter.sort_order" />
          </div>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showChapterModal=false">取消</button>
          <button class="btn" @click="saveChapter">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showTopicEntryModal" class="modal-overlay" @click.self="showTopicEntryModal=false">
      <div class="modal sm-modal">
        <h3>{{ editingTopicEntry.id ? '编辑词条挂接' : '挂接词条' }}</h3>
        <div v-if="!editingTopicEntry.id" class="form-group">
          <label>选择词条 *</label>
          <select v-model="editingTopicEntry.entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div v-else class="form-group">
          <label>词条</label>
          <input :value="editingTopicEntry.entry_title" disabled />
        </div>
        <div class="form-group">
          <label>备注说明</label>
          <textarea v-model="editingTopicEntry.note" style="min-height:80px;"></textarea>
        </div>
        <div class="form-group">
          <label>排序</label>
          <input type="number" v-model.number="editingTopicEntry.sort_order" />
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showTopicEntryModal=false">取消</button>
          <button class="btn" @click="saveTopicEntry">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { entriesAPI, versionsAPI, referencesAPI, adminAPI, ROLES, ROLE_LABELS, ROLE_LEVELS, handleApiError, submissionsAPI } from '../api';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();

const tab = ref('entries');
const stats = ref({ entries: 0, versions: 0, images: 0, annotations: 0, references: 0, users: 0, topics: 0, chapters: 0 });
const entries = ref([]);
const entriesMin = ref([]);
const versions = ref([]);
const allRefs = ref([]);

const topics = ref([]);
const showTopicModal = ref(false);
const editingTopic = reactive({ id: null, title: '', subtitle: '', author: '', summary: '', cover_url: '', status: 'draft', sort_order: 0 });

const showChapterEditor = ref(false);
const currentTopic = ref(null);
const chapters = ref([]);
const showChapterModal = ref(false);
const editingChapter = reactive({ id: null, topic_id: null, title: '', subtitle: '', content: '', sort_order: 0, status: 'draft' });

const showChapterEntries = ref(false);
const currentChapter = ref(null);
const chapterEntries = ref([]);
const showTopicEntries = ref(false);
const topicEntries = ref([]);
const showTopicEntryModal = ref(false);
const topicEntryTargetType = ref('chapter');
const editingTopicEntry = reactive({ id: null, topic_id: null, chapter_id: null, entry_id: null, entry_title: '', note: '', sort_order: 0 });

const showEntryModal = ref(false);
const editingEntry = reactive({ id: null, title: '', author: '', dynasty: '', summary: '', cover_url: '' });

const showVersionModal = ref(false);
const editingVersion = reactive({ id: null, entry_id: null, version_name: '', publisher: '', pub_year: '', pages: null, isbn: '', description: '', full_text: '' });

const showRefModal = ref(false);
const newRef = reactive({ from_entry_id: null, to_entry_id: null, relation_type: '相关', note: '' });

const users = ref([]);
const userSearch = ref('');
const showUserModal = ref(false);
const editingUser = reactive({ id: null, username: '', password: '', displayName: '', email: '', role: ROLES.VIEWER, status: 'active' });
const userError = ref('');

const showResetPwdModal = ref(false);
const resetPwdUser = ref(null);
const resetPwdForm = reactive({ newPassword: '', confirmPassword: '' });
const resetPwdLoading = ref(false);
const resetPwdError = ref('');
const resetPwdSuccess = ref('');

const submissions = ref([]);
const submissionFilter = ref('all');
const showSubmissionDetail = ref(false);
const currentSubmission = ref(null);
const showReviewModal = ref(false);
const reviewAction = ref('approve');
const reviewSubmission = ref(null);
const reviewForm = reactive({
  review_note: '',
  create_new_entry: true,
  entry_title: '',
  entry_author: '',
  entry_id: null
});
const reviewLoading = ref(false);
const reviewError = ref('');
const imagePreview = ref(null);

const canManageUsers = computed(() =>
  userStore.hasRoleLevel(ROLES.EDITOR)
);

const canCreateUser = computed(() =>
  userStore.hasRoleLevel(ROLES.EDITOR)
);

const assignableRoles = computed(() => {
  const curLevel = ROLE_LEVELS[userStore.role] || 0;
  return [
    { value: ROLES.VIEWER, label: '访问学者（viewer）', level: 1 },
    { value: ROLES.EDITOR, label: '编辑（editor）', level: 2 },
    { value: ROLES.ADMIN, label: '管理员（admin）', level: 3 }
  ].filter(r => r.level < curLevel);
});

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value;
  const q = userSearch.value.toLowerCase();
  return users.value.filter(u =>
    u.username.toLowerCase().includes(q) ||
    (u.displayName && u.displayName.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  );
});

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
function roleTagClass(role) {
  return {
    'role-admin': role === ROLES.ADMIN,
    'role-editor': role === ROLES.EDITOR,
    'role-viewer': role === ROLES.VIEWER
  };
}

async function loadAll() {
  try {
    const [s, e, v, em, tp] = await Promise.all([
      adminAPI.stats(),
      adminAPI.entries(),
      adminAPI.versions(),
      adminAPI.allEntries(),
      adminAPI.topics()
    ]);
    stats.value = s.data;
    entries.value = e.data;
    versions.value = v.data;
    entriesMin.value = em.data;
    topics.value = tp.data;

    const map = Object.fromEntries(em.data.map(x => [x.id, x.title]));
    const refsList = [];
    for (const entry of em.data) {
      const { data } = await referencesAPI.listByEntry(entry.id);
      for (const r of data.outgoing) {
        r.from_title = map[r.from_entry_id];
        r.to_title = map[r.to_entry_id];
        refsList.push(r);
      }
    }
    const seen = new Set();
    allRefs.value = refsList.filter(r => {
      const k = `${r.from_entry_id}-${r.to_entry_id}-${r.relation_type}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    if (canManageUsers.value) {
      try {
        const { data: udata } = await adminAPI.users();
        users.value = udata;
      } catch (e2) {
        // 忽略权限不足
      }
    }
  } catch (e) {
    alert('加载数据失败: ' + handleApiError(e));
  }
}

function openEntryModal(e = null) {
  if (e) Object.assign(editingEntry, e);
  else Object.assign(editingEntry, { id: null, title: '', author: '', dynasty: '', summary: '', cover_url: '' });
  showEntryModal.value = true;
}

async function saveEntry() {
  if (!editingEntry.title) return alert('请填写书名');
  try {
    if (editingEntry.id) await entriesAPI.update(editingEntry.id, editingEntry);
    else await entriesAPI.create(editingEntry);
    showEntryModal.value = false;
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delEntry(e) {
  if (!confirm(`确认删除词条《${e.title}》及其所有版本？`)) return;
  try {
    await entriesAPI.remove(e.id);
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

function openVersionModal(v = null) {
  if (v) Object.assign(editingVersion, v);
  else Object.assign(editingVersion, { id: null, entry_id: entriesMin.value[0]?.id, version_name: '', publisher: '', pub_year: '', pages: null, isbn: '', description: '', full_text: '' });
  showVersionModal.value = true;
}

async function saveVersion() {
  if (!editingVersion.entry_id || !editingVersion.version_name) return alert('请填写必填项');
  try {
    if (editingVersion.id) await versionsAPI.update(editingVersion.id, editingVersion);
    else await versionsAPI.create(editingVersion);
    showVersionModal.value = false;
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delVersion(v) {
  if (!confirm(`确认删除版本「${v.version_name}」？`)) return;
  try {
    await versionsAPI.remove(v.id);
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

function openRefModal() {
  if (entriesMin.value.length >= 2) {
    newRef.from_entry_id = entriesMin.value[0].id;
    newRef.to_entry_id = entriesMin.value[1].id;
  }
  newRef.relation_type = '相关';
  newRef.note = '';
  showRefModal.value = true;
}

async function saveRef() {
  if (!newRef.from_entry_id || !newRef.to_entry_id) return alert('请选择词条');
  if (newRef.from_entry_id === newRef.to_entry_id) return alert('源和目标不能相同');
  try {
    await referencesAPI.create(newRef);
    showRefModal.value = false;
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delRef(r) {
  if (!confirm('确认删除该引用关系？')) return;
  try {
    await referencesAPI.remove(r.id);
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

async function loadSubmissions() {
  try {
    const params = submissionFilter.value !== 'all' ? { status: submissionFilter.value } : {};
    const { data } = await submissionsAPI.list(params);
    submissions.value = data.list.map(s => ({
      ...s,
      image_count: s.images?.length || 0
    }));
  } catch (e) {
    console.error('加载征集列表失败', e);
  }
}

function submissionStatusLabel(status) {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  return labels[status] || status;
}

function submissionStatusClass(status) {
  return {
    pending: 'status-pending',
    approved: 'status-active',
    rejected: 'status-disabled'
  }[status] || '';
}

async function viewSubmissionDetail(s) {
  try {
    const { data } = await submissionsAPI.get(s.id);
    currentSubmission.value = data;
    showSubmissionDetail.value = true;
  } catch (e) {
    alert('获取详情失败: ' + handleApiError(e));
  }
}

function openReviewModal(s, action) {
  showSubmissionDetail.value = false;
  reviewSubmission.value = s;
  reviewAction.value = action;
  reviewError.value = '';
  Object.assign(reviewForm, {
    review_note: '',
    create_new_entry: !s.entry_id,
    entry_title: s.entry_title || '',
    entry_author: s.entry_author || '',
    entry_id: s.entry_id || null
  });
  showReviewModal.value = true;
}

async function submitReview() {
  if (!reviewSubmission.value) return;

  if (reviewAction.value === 'approve' && !reviewSubmission.value.entry_id) {
    if (reviewForm.create_new_entry && !reviewForm.entry_title.trim()) {
      reviewError.value = '请填写书名字段';
      return;
    }
    if (!reviewForm.create_new_entry && !reviewForm.entry_id) {
      reviewError.value = '请选择关联词条';
      return;
    }
  }

  reviewLoading.value = true;
  reviewError.value = '';
  try {
    if (reviewAction.value === 'approve') {
      const payload = {
        review_note: reviewForm.review_note,
        create_new_entry: reviewForm.create_new_entry,
        entry_title: reviewForm.entry_title,
        entry_author: reviewForm.entry_author
      };
      if (!reviewForm.create_new_entry && reviewForm.entry_id) {
        payload.entry_id = reviewForm.entry_id;
      }
      await submissionsAPI.approve(reviewSubmission.value.id, payload);
    } else {
      await submissionsAPI.reject(reviewSubmission.value.id, { review_note: reviewForm.review_note });
    }
    showReviewModal.value = false;
    loadAll();
    loadSubmissions();
  } catch (e) {
    reviewError.value = handleApiError(e, '操作失败');
  } finally {
    reviewLoading.value = false;
  }
}

async function delSubmission(s) {
  if (!confirm(`确认删除征集 #${s.id}？`)) return;
  try {
    await submissionsAPI.remove(s.id);
    loadAll();
    loadSubmissions();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

function previewImage(url) {
  imagePreview.value = url;
}

watch(tab, (newTab) => {
  if (newTab === 'submissions') {
    loadSubmissions();
  }
});

function openUserModal(u = null) {
  userError.value = '';
  if (u) {
    Object.assign(editingUser, {
      id: u.id,
      username: u.username,
      password: '',
      displayName: u.displayName || u.display_name || '',
      email: u.email || '',
      role: u.role,
      status: u.status
    });
  } else {
    Object.assign(editingUser, {
      id: null, username: '', password: '',
      displayName: '', email: '',
      role: assignableRoles.value[0]?.value || ROLES.VIEWER,
      status: 'active'
    });
  }
  showUserModal.value = true;
}

async function saveUser() {
  userError.value = '';
  if (!editingUser.id) {
    if (!editingUser.username || editingUser.username.length < 3) {
      userError.value = '用户名至少需要3位';
      return;
    }
    if (!editingUser.password || editingUser.password.length < 6) {
      userError.value = '初始密码至少需要6位';
      return;
    }
    try {
      await adminAPI.createUser({
        username: editingUser.username,
        password: editingUser.password,
        displayName: editingUser.displayName,
        email: editingUser.email,
        role: editingUser.role
      });
    } catch (e) {
      userError.value = handleApiError(e, '创建失败');
      return;
    }
  } else {
    try {
      await adminAPI.updateUser(editingUser.id, {
        displayName: editingUser.displayName,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status
      });
    } catch (e) {
      userError.value = handleApiError(e, '保存失败');
      return;
    }
  }
  showUserModal.value = false;
  loadAll();
}

async function toggleUserStatus(u) {
  const action = u.status === 'active' ? '禁用' : '恢复';
  if (!confirm(`确认${action}学者「${u.username}」的账号？`)) return;
  try {
    await adminAPI.toggleUserStatus(u.id);
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '操作失败'));
  }
}

async function delUser(u) {
  if (!confirm(`确认删除学者「${u.username}」的账号？此操作不可撤销！`)) return;
  try {
    await adminAPI.removeUser(u.id);
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '删除失败'));
  }
}

function openResetPwdModal(u) {
  resetPwdUser.value = u;
  resetPwdForm.newPassword = '';
  resetPwdForm.confirmPassword = '';
  resetPwdError.value = '';
  resetPwdSuccess.value = '';
  showResetPwdModal.value = true;
}

async function submitResetPwd() {
  resetPwdError.value = '';
  resetPwdSuccess.value = '';
  if (resetPwdForm.newPassword.length < 6) {
    resetPwdError.value = '新密码至少需要6位';
    return;
  }
  if (resetPwdForm.newPassword !== resetPwdForm.confirmPassword) {
    resetPwdError.value = '两次输入的密码不一致';
    return;
  }
  resetPwdLoading.value = true;
  try {
    await adminAPI.resetPassword(resetPwdUser.value.id, resetPwdForm.newPassword);
    resetPwdSuccess.value = '密码重置成功！';
    setTimeout(() => (showResetPwdModal.value = false), 1000);
  } catch (e) {
    resetPwdError.value = handleApiError(e, '重置失败');
  } finally {
    resetPwdLoading.value = false;
  }
}

function openTopicModal(t = null) {
  if (t) Object.assign(editingTopic, t);
  else Object.assign(editingTopic, { id: null, title: '', subtitle: '', author: '', summary: '', cover_url: '', status: 'draft', sort_order: 0 });
  showTopicModal.value = true;
}

async function saveTopic() {
  if (!editingTopic.title) return alert('请填写专题标题');
  try {
    if (editingTopic.id) await adminAPI.updateTopic(editingTopic.id, editingTopic);
    else await adminAPI.createTopic(editingTopic);
    showTopicModal.value = false;
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delTopic(t) {
  if (!confirm('确认删除专题「' + t.title + '」及其所有章节？')) return;
  try {
    await adminAPI.removeTopic(t.id);
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

async function editTopicChapters(t) {
  currentTopic.value = t;
  showChapterEditor.value = true;
  showChapterEntries.value = false;
  showTopicEntries.value = false;
  try {
    const { data } = await adminAPI.topicChapters(t.id);
    chapters.value = data;
  } catch (e) {
    alert(handleApiError(e, '加载章节失败'));
  }
}

async function editTopicEntries(t) {
  currentTopic.value = t;
  showTopicEntries.value = true;
  showChapterEditor.value = false;
  showChapterEntries.value = false;
  try {
    const { data } = await adminAPI.topic(t.id);
    topicEntries.value = data.entries || [];
  } catch (e) {
    alert(handleApiError(e, '加载词条失败'));
  }
}

function openChapterModal(c = null) {
  if (c) Object.assign(editingChapter, c);
  else Object.assign(editingChapter, { id: null, topic_id: currentTopic.value?.id, title: '', subtitle: '', content: '', sort_order: 0, status: 'draft' });
  showChapterModal.value = true;
}

async function saveChapter() {
  if (!editingChapter.title) return alert('请填写章节标题');
  try {
    if (editingChapter.id) await adminAPI.updateChapter(editingChapter.id, editingChapter);
    else await adminAPI.createChapter(currentTopic.value.id, editingChapter);
    showChapterModal.value = false;
    editTopicChapters(currentTopic.value);
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delChapter(c) {
  if (!confirm('确认删除章节「' + c.title + '」？')) return;
  try {
    await adminAPI.removeChapter(c.id);
    editTopicChapters(currentTopic.value);
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

async function editChapterEntries(c) {
  currentChapter.value = c;
  showChapterEntries.value = true;
  try {
    const { data } = await adminAPI.chapter(c.id);
    chapterEntries.value = data.entries || [];
  } catch (e) {
    alert(handleApiError(e, '加载词条失败'));
  }
}

function openTopicEntryModal(type, te = null) {
  topicEntryTargetType.value = type;
  if (te) {
    Object.assign(editingTopicEntry, te);
  } else {
    Object.assign(editingTopicEntry, {
      id: null,
      topic_id: type === 'topic' ? currentTopic.value?.id : null,
      chapter_id: type === 'chapter' ? currentChapter.value?.id : null,
      entry_id: entriesMin.value[0]?.id,
      entry_title: '',
      note: '',
      sort_order: 0
    });
  }
  showTopicEntryModal.value = true;
}

async function saveTopicEntry() {
  if (!editingTopicEntry.entry_id) return alert('请选择词条');
  try {
    if (editingTopicEntry.id) await adminAPI.updateTopicEntry(editingTopicEntry.id, editingTopicEntry);
    else await adminAPI.createTopicEntry(editingTopicEntry);
    showTopicEntryModal.value = false;
    if (topicEntryTargetType.value === 'chapter' && currentChapter.value) {
      editChapterEntries(currentChapter.value);
    } else if (topicEntryTargetType.value === 'topic' && currentTopic.value) {
      editTopicEntries(currentTopic.value);
    }
    loadAll();
  } catch (e) {
    alert(handleApiError(e, '保存失败'));
  }
}

async function delTopicEntry(te) {
  if (!confirm('确认删除该词条挂接？')) return;
  try {
    await adminAPI.removeTopicEntry(te.id);
    if (topicEntryTargetType.value === 'chapter' && currentChapter.value) {
      editChapterEntries(currentChapter.value);
    } else if (topicEntryTargetType.value === 'topic' && currentTopic.value) {
      editTopicEntries(currentTopic.value);
    }
    loadAll();
  } catch (err) {
    alert(handleApiError(err, '删除失败'));
  }
}

onMounted(loadAll);
</script>

<style>
.role-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.4;
  display: inline-block;
}
.role-admin { background: rgba(239,68,68,0.1); color: #b91c1c; }
.role-editor { background: rgba(245,158,11,0.1); color: #a16207; }
.role-viewer { background: rgba(34,197,94,0.1); color: #15803d; }
.status-tag {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.4;
  display: inline-block;
}
.status-active { background: rgba(34,197,94,0.1); color: #15803d; }
.status-disabled { background: rgba(107,114,128,0.1); color: #4b5563; }
.status-pending { background: rgba(245, 158, 11, 0.1); color: #a16207; }
.btn.warning { background: #f59e0b; }
.btn.warning:hover { background: #d97706; }
.btn.success { background: #22c55e; }
.btn.success:hover { background: #16a34a; }
.sm-modal { max-width: 420px; }

.badge {
  display: inline-block;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #dc2626;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  margin-left: 4px;
}

.pending-alert {
  animation: pulse 2s infinite;
  border: 2px solid #f59e0b;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}

.detail-modal {
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  flex-wrap: wrap;
}

.detail-row .label {
  width: 100px;
  color: #666;
  flex-shrink: 0;
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 2px solid #f0f0f0;
}

.detail-section h4 {
  color: var(--primary-dark);
  margin-bottom: 12px;
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.detail-image-item {
  text-align: center;
}

.detail-image-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.detail-image-item img:hover {
  transform: scale(1.05);
}

.image-caption-text {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.image-preview-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.image-preview-modal img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.close-preview {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: none;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn.danger {
  background: #dc2626;
  color: #fff;
}
.btn.danger:hover {
  background: #b91c1c;
}
</style>

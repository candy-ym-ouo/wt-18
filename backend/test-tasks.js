const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImRpc3BsYXlOYW1lIjoi5bmz5Y-w566h55CG5ZGYIiwiaWF0IjoxNzgyMDIxNjk2LCJleHAiOjE3ODI2MjY0OTZ9.S132PeJ7WBKWiHHikp7dwyp2642twCSjjlxqlYxoNjg';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject({ status: res.statusCode, data });
          }
        } catch (e) {
          reject({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  try {
    console.log('=== 测试任务 API ===\n');

    console.log('1. 测试创建任务...');
    const createRes = await request('POST', '/api/tasks', {
      title: '测试研究任务',
      description: '这是一个测试任务，用于验证任务功能是否正常工作',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-07-01',
      assigneeIds: [1]
    });
    console.log('✓ 创建任务成功');
    console.log('  ID:', createRes.id);
    console.log('  标题:', createRes.title);
    console.log('  状态:', createRes.status);

    const taskId = createRes.id;

    console.log('\n2. 测试获取任务详情...');
    const getRes = await request('GET', '/api/tasks/' + taskId);
    console.log('✓ 获取任务详情成功');
    console.log('  创建者:', getRes.creator.display_name);
    console.log('  负责人:', getRes.assignees.map(a => a.display_name).join(', '));

    console.log('\n3. 测试获取看板数据...');
    const boardRes = await request('GET', '/api/tasks/board');
    console.log('✓ 获取看板成功');
    console.log('  待办:', boardRes.todo.length);
    console.log('  进行中:', boardRes.in_progress.length);
    console.log('  审核中:', boardRes.review.length);
    console.log('  已完成:', boardRes.done.length);

    console.log('\n4. 测试更新任务状态...');
    const statusRes = await request('PATCH', '/api/tasks/' + taskId + '/status', {
      status: 'in_progress'
    });
    console.log('✓ 更新状态成功，新状态:', statusRes.status);

    console.log('\n5. 测试添加评论...');
    const commentRes = await request('POST', '/api/tasks/' + taskId + '/comments', {
      content: '这是一条测试评论，用于讨论任务进度'
    });
    console.log('✓ 添加评论成功');
    console.log('  评论ID:', commentRes.id);
    console.log('  评论内容:', commentRes.content);

    console.log('\n6. 测试获取评论列表...');
    const commentsRes = await request('GET', '/api/tasks/' + taskId + '/comments');
    console.log('✓ 获取评论列表成功，共', commentsRes.length, '条评论');

    console.log('\n7. 测试获取状态列表...');
    const statusesRes = await request('GET', '/api/tasks/statuses');
    console.log('✓ 获取状态列表成功:', statusesRes.map(s => s.label).join(', '));

    console.log('\n8. 测试获取优先级列表...');
    const prioritiesRes = await request('GET', '/api/tasks/priorities');
    console.log('✓ 获取优先级列表成功:', prioritiesRes.map(p => p.label).join(', '));

    console.log('\n9. 测试更新任务...');
    const updateRes = await request('PUT', '/api/tasks/' + taskId, {
      title: '更新后的测试任务',
      priority: 'urgent'
    });
    console.log('✓ 更新任务成功');
    console.log('  新标题:', updateRes.title);
    console.log('  新优先级:', updateRes.priority);

    console.log('\n10. 测试删除任务...');
    await request('DELETE', '/api/tasks/' + taskId);
    console.log('✓ 删除任务成功');

    console.log('\n=== 所有测试通过！ ===');
  } catch (e) {
    console.error('✗ 测试失败:', e.status, e.data);
    process.exit(1);
  }
}

test();

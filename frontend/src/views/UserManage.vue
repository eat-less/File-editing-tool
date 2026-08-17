<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>用户管理</h3>
      <el-button type="primary" @click="showCreate = true">新建用户</el-button>
    </div>
    <el-table :data="users" border stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'superadmin' ? 'danger' : 'info'" size="small">
            {{ row.role === 'superadmin' ? '超管' : '普通' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'warning'" size="small">
            {{ row.is_active ? '正常' : '已禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="last_login" label="最后登录" width="180">
        <template #default="{ row }">{{ formatDate(row.last_login) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button
            size="small"
            type="danger"
            :disabled="row.role === 'superadmin'"
            @click="deleteUserHandle(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreate" title="新建用户" width="460px">
      <el-form :model="form">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%">
            <el-option label="普通用户" value="normal" />
            <el-option label="超管" value="superadmin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="createUserHandle">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getUsers, createUser, deleteUser } from '@/api/auth'
import { formatDate } from '@/utils/validators'
import type { User } from '@/types'

const loading = ref(false)
const showCreate = ref(false)
const users = ref<User[]>([])
const form = reactive({ username: '', password: '', role: 'normal' })

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers()
    users.value = res.data
  } finally {
    loading.value = false
  }
}

async function createUserHandle() {
  if (!form.username || !form.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  try {
    await createUser(form.username, form.password, form.role)
    showCreate.value = false
    form.username = ''; form.password = ''; form.role = 'normal'
    ElMessage.success('创建成功')
    await loadUsers()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '创建失败')
  }
}

async function deleteUserHandle(row: User) {
  try {
    await ElMessageBox.confirm(`确定删除用户 "${row.username}"？`, '警告', { type: 'warning' })
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    await loadUsers()
  } catch { /* cancelled */ }
}

onMounted(() => loadUsers())
</script>

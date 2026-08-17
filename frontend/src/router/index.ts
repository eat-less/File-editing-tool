import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/',
      component: () => import('@/views/layout/MainLayout.vue'),
      meta: { requiresAuth: true },
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '仪表盘' } },
        { path: 'exhibits', name: 'ExhibitManage', component: () => import('@/views/ExhibitManage.vue'), meta: { title: '展项管理' } },
        { path: 'exhibits/:id', name: 'SceneManage', component: () => import('@/views/SceneManage.vue'), meta: { title: '场景管理' } },
        { path: 'content', name: 'ContentList', component: () => import('@/views/content/ContentList.vue'), meta: { title: '内容管理' } },
        { path: 'content/:id/distribution', name: 'DistributionDetail', component: () => import('@/views/content/DistributionDetail.vue'), meta: { title: '分发详情' } },
        { path: 'content/:id/versions', name: 'VersionHistory', component: () => import('@/views/content/VersionHistory.vue'), meta: { title: '版本历史' } },
        { path: 'editor/:programId', name: 'EditorView', component: () => import('@/views/editor/EditorView.vue'), meta: { title: '编辑器' } },
        { path: 'logs', name: 'LogView', component: () => import('@/views/LogView.vue'), meta: { title: '系统日志' } },
        { path: 'users', name: 'UserManage', component: () => import('@/views/UserManage.vue'), meta: { title: '用户管理' } }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router

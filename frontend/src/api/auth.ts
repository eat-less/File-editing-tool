import request from './request'

export const login = (username: string, password: string) =>
  request.post('/auth/login', { username, password })

export const logout = () =>
  request.post('/auth/logout')

export const checkAuth = () =>
  request.get('/auth/check')

export const getUsers = () =>
  request.get('/auth/users')

export const createUser = (username: string, password: string, role: string = 'normal') =>
  request.post('/auth/users', { username, password, role })

export const deleteUser = (id: string) =>
  request.delete(`/auth/users/${id}`)

'use client'

import { useState } from 'react'

interface Task {
  id: number
  title: string
  description: string
  completed: boolean
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: 'Task 1', description: 'Description 1', completed: false },
    { id: 2, title: 'Task 2', description: 'Description 2', completed: true },
  ])
  const [newTask, setNewTask] = useState('')

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { id: Date.now(), title: newTask, description: '', completed: false }])
      setNewTask('')
    }
  }

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id))
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Task List</h2>
      <div className="mb-4">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add new task"
          className="border p-2 w-full"
        />
        <button onClick={addTask} className="bg-blue-500 text-white p-2 mt-2 w-full">Add Task</button>
      </div>
      <ul>
        {tasks.map(task => (
          <li key={task.id} className="flex items-center justify-between p-2 border-b">
            <div>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                className="mr-2"
              />
              <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-red-500">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
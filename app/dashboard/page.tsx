"use client";

import { MainLayout } from "@/components/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Settings,
  Play,
  Download,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

const quickActions = [
  {
    title: "Upload Dataset",
    description: "เพิ่ม Dataset สำหรับ Training",
    icon: Database,
    href: "/dataset",
    color: "bg-gray-100 dark:bg-gray-800",
  },
  {
    title: "Configure Model",
    description: "ปรับค่า Training Parameters",
    icon: Settings,
    href: "/config",
    color: "bg-gray-100 dark:bg-gray-800",
  },
  {
    title: "Start Training",
    description: "เริ่ม Training Model",
    icon: Play,
    href: "/training",
    color: "bg-gray-100 dark:bg-gray-800",
  },
  {
    title: "View Results",
    description: "ดูผลลัพธ์และดาวน์โหลด Model",
    icon: Download,
    href: "/results",
    color: "bg-gray-100 dark:bg-gray-800",
  },
];

const recentActivities = [
  {
    id: 1,
    type: "completed",
    message: "Training completed: custom_model_v1",
    time: "2 hours ago",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  {
    id: 2,
    type: "info",
    message: "Dataset uploaded: traffic_signs (1,234 images)",
    time: "5 hours ago",
    icon: Database,
    iconColor: "text-gray-500",
  },
  {
    id: 3,
    type: "warning",
    message: "Low GPU memory detected",
    time: "1 day ago",
    icon: AlertCircle,
    iconColor: "text-yellow-500",
  },
];

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            ยินดีต้อนรับสู่ Model Training Platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Datasets
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    3
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                  <Database className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Trained Models
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    7
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                  <CheckCircle2 className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Training Hours
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    24.5
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                  <Clock className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    GPU Status
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      Ready
                    </p>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                  <Settings className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Training (if any) */}
        <Card>
          <CardHeader>
            <CardTitle>Current Training</CardTitle>
            <CardDescription>ไม่มี Training ที่กำลังทำงาน</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center dark:bg-gray-800">
                <Play className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                เริ่มต้น Training ใหม่เพื่อดู Progress ที่นี่
              </p>
              <Link href="/config">
                <Button className="mt-4">
                  Start New Training
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Recent Activities */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>ทางลัดไปยังหน้าต่างๆ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href}>
                    <div className="group cursor-pointer rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/50">
                      <div
                        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}
                      >
                        <action.icon className="h-5 w-5 text-gray-900 dark:text-white" />
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {action.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {action.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>กิจกรรมล่าสุด</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                  >
                    <activity.icon
                      className={`h-5 w-5 mt-0.5 ${activity.iconColor}`}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

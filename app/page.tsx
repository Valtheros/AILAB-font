import Link from "next/link";
import { ArrowRight, Cpu, Zap, Shield, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-gray-900 dark:via-black dark:to-gray-900" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/50 px-4 py-1.5 text-sm backdrop-blur-sm dark:border-gray-800 dark:bg-white/5">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                YOLOv11 Supported
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl">
              Train AI Models
              <span className="mt-2 block text-gray-400 dark:text-gray-500">
                Without Code
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
              ทำให้การ Train Object Detection Model เป็นเรื่องง่าย เพียงอัพโหลด
              Dataset และปรับค่า Config ผ่าน UI ระบบจะจัดการทุกอย่างให้คุณ
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className="group flex h-12 items-center gap-2 rounded-full bg-gray-900 px-8 text-sm font-semibold text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="https://docs.ultralytics.com/models/yolo11/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 rounded-full border border-gray-300 px-8 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t border-gray-200 bg-gray-50 py-24 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              เครื่องมือครบวงจรสำหรับการ Train โมเดล Object Detection
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Cpu,
                title: "YOLOv11",
                description: "รองรับทุก Model Variant ตั้งแต่ nano ถึง xlarge",
              },
              {
                icon: Zap,
                title: "Easy Config",
                description: "ปรับค่า Training Parameters ผ่าน UI ได้ทันที",
              },
              {
                icon: Layers,
                title: "Data Augmentation",
                description:
                  "เพิ่มประสิทธิภาพ Model ด้วย Augmentation หลากหลาย",
              },
              {
                icon: Shield,
                title: "Real-time Metrics",
                description: "ติดตามผลลัพธ์การ Train แบบ Real-time",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                  <feature.icon className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Section */}
      <div className="border-t border-gray-200 py-24 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Simple Workflow
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              3 ขั้นตอนง่ายๆ สู่โมเดลที่พร้อมใช้งาน
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload Dataset",
                description: "อัพโหลดรูปภาพและ Annotations ในรูปแบบ YOLO",
              },
              {
                step: "02",
                title: "Configure & Train",
                description: "ปรับค่า Parameters และเริ่ม Training",
              },
              {
                step: "03",
                title: "Download Model",
                description: "ดาวน์โหลด Trained Model พร้อมใช้งาน",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative text-center">
                {index < 2 && (
                  <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-gray-200 dark:bg-gray-800 sm:block" />
                )}
                <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-xl font-bold text-gray-900 dark:border-white dark:bg-black dark:text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-gray-900 dark:text-white" />
              <span className="font-semibold text-gray-900 dark:text-white">
                Model Train
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Built with Next.js • Powered by Ultralytics YOLOv11
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

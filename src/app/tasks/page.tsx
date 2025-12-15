"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/use-auth";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function TasksPage() {
  const { user, loading } = useRequireAuth();
  const { data, mutate } = useSWR(user ? "/api/tasks" : null, fetcher);
  const tasks = data?.tasks ?? [];
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"unsubscribe"|"close_account"|"update_email"|"enable_2fa"|"review">("review");
  const [sortBy, setSortBy] = useState<"due"|"created"|"title">("due");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  const createTask = async () => {
    if (!title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type }),
    });
    setTitle("");
    await mutate();
  };

  const updateTask = async (patch: any) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await mutate();
  };

  const sortTasks = (arr: any[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...arr].sort((a: any, b: any) => {
      if (sortBy === "title") {
        const av = String(a.title || "");
        const bv = String(b.title || "");
        return av.localeCompare(bv) * dir;
      } else if (sortBy === "created") {
        const av = Number(a.createdAt || 0);
        const bv = Number(b.createdAt || 0);
        return (av - bv) * dir;
      } else {
        const av = Number(a.dueAt ?? Number.POSITIVE_INFINITY);
        const bv = Number(b.dueAt ?? Number.POSITIVE_INFINITY);
        return (av - bv) * dir;
      }
    });
  };

  const grouped = {
    open: tasks.filter((t: any) => t.status === "open"),
    in_progress: tasks.filter((t: any) => t.status === "in_progress"),
    done: tasks.filter((t: any) => t.status === "done"),
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Tasks</CardTitle>
          <CardDescription>Create and track actions for your accounts.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="unsubscribe">Unsubscribe</SelectItem>
              <SelectItem value="close_account">Close Account</SelectItem>
              <SelectItem value="update_email">Update Email</SelectItem>
              <SelectItem value="enable_2fa">Enable 2FA</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={createTask}>Create task</Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due date</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={(v) => setSortDir(v as any)}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Asc</SelectItem>
                <SelectItem value="desc">Desc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {["open", "in_progress", "done"].map((status) => (
        <Card key={status} className="mb-6">
          <CardHeader>
            <CardTitle className="font-headline capitalize">
              {status.replace("_", " ")}
            </CardTitle>
            <CardDescription>
              {grouped[status as keyof typeof grouped].length} tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 md:hidden">
              {sortTasks(grouped[status as keyof typeof grouped]).map(
                (t: any) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                  >
                    <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      {status.replace("_", " ")}
                    </div>
                    <div className="font-medium">{t.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.dueAt
                        ? new Date(t.dueAt).toLocaleString()
                        : "No due date"}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="capitalize">{t.type}</span>
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          updateTask({ id: t.id, status: v })
                        }
                      >
                        <SelectTrigger className="w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              )}
              {!grouped[status as keyof typeof grouped].length && (
                <div className="rounded-lg border border-dashed border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortTasks(
                      grouped[status as keyof typeof grouped]
                    ).map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.title}
                        </TableCell>
                        <TableCell className="capitalize">
                          {t.type}
                        </TableCell>
                        <TableCell>
                          {t.dueAt
                            ? new Date(t.dueAt).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={t.status}
                            onValueChange={(v) =>
                              updateTask({ id: t.id, status: v })
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">
                                Open
                              </SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="done">
                                Done
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!grouped[status as keyof typeof grouped].length && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-sm text-muted-foreground"
                        >
                          No tasks
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

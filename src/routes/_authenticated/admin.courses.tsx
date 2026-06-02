import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllCourses, createCourse, updateCourse, deleteCourse,
  listCourseManagers, createCourseManager, removeCourseManager,
} from "@/lib/courses.functions";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Users, Plus, Pencil, Upload, ImageIcon, LayoutDashboard, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { isSuperadmin } = useAuth();
  const listFn = useServerFn(listAllCourses);
  const delFn = useServerFn(deleteCourse);
  const qc = useQueryClient();
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["all-courses"],
    queryFn: () => listFn(),
    enabled: isSuperadmin,
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<any | null>(null);

  if (!isSuperadmin) return <p className="text-sm text-muted-foreground">SuperAdmin only.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New course
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Logo</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Public</th>
              <th className="px-4 py-2">Sort</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && courses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No courses yet.</td></tr>
            )}
            {courses.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">
                  <LogoCell course={c} onUpdated={() => qc.invalidateQueries({ queryKey: ["all-courses"] })} />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ background: c.primary_color }} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">/{c.slug}</td>
                <td className="px-4 py-2">{c.public_enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-2">{c.display_sort}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <Link
                      to="/admin/course/$courseId"
                      params={{ courseId: c.id }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      title="Open course dashboard"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <button onClick={() => setManaging(c)} className="rounded-md border px-2 py-1 hover:bg-accent" title="Managers">
                      <Users className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(c)} className="rounded-md border px-2 py-1 hover:bg-accent" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${c.name}" and ALL its entries?`)) return;
                        try {
                          await delFn({ data: { id: c.id } } as any);
                          toast.success("Course deleted");
                          qc.invalidateQueries({ queryKey: ["all-courses"] });
                          qc.invalidateQueries({ queryKey: ["my-courses"] });
                        } catch (e: any) { toast.error(e.message); }
                      }}
                      className="rounded-md border px-2 py-1 text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <CourseDialog
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["all-courses"] });
            qc.invalidateQueries({ queryKey: ["my-courses"] });
          }}
        />
      )}
      {managing && <ManagersDialog course={managing} onClose={() => setManaging(null)} />}
    </div>
  );
}

function CourseDialog({ initial, onClose, onSaved }: { initial: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [primary, setPrimary] = useState(initial?.primary_color ?? "#0f5132");
  const [secondary, setSecondary] = useState(initial?.secondary_color ?? "#f3f4f6");
  const [publicEnabled, setPublicEnabled] = useState<boolean>(initial?.public_enabled ?? true);
  const [sort, setSort] = useState<"newest" | "hole" | "year">(initial?.display_sort ?? "newest");
  const [logo, setLogo] = useState<string | null>(initial?.logo_url ?? null);
  const [submitting, setSubmitting] = useState(false);
  const createFn = useServerFn(createCourse);
  const updateFn = useServerFn(updateCourse);

  const handleLogoUpload = async (file: File) => {
    const path = `${(slug || crypto.randomUUID())}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("course-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("course-logos").getPublicUrl(path);
    setLogo(data.publicUrl);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name, slug,
        primary_color: primary, secondary_color: secondary,
        public_enabled: publicEnabled, display_sort: sort,
        logo_url: logo,
      };
      if (isEdit) await updateFn({ data: { id: initial.id, ...payload } } as any);
      else await createFn({ data: payload } as any);
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit course" : "New course"}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Slug (URL)">
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            pattern="[a-z0-9-]+"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-muted-foreground">/{slug || "your-course"}/hole-in-ones</p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary color">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded-md border" />
          </Field>
          <Field label="Secondary color">
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-full rounded-md border" />
          </Field>
        </div>
        <Field label="Logo">
          <div className="flex items-center gap-3">
            <label className="group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-white hover:border-primary">
              {logo ? (
                <img src={logo} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
                <Upload className="h-4 w-4" />
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
            </label>
            <div className="text-xs text-muted-foreground">
              {logo ? "Click to replace" : "PNG, JPG or SVG. Click the tile to upload."}
            </div>
            {logo && (
              <button type="button" onClick={() => setLogo(null)} className="ml-auto text-xs text-muted-foreground hover:text-destructive">Remove</button>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display sort">
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={inputCls}>
              <option value="newest">Newest first</option>
              <option value="hole">By hole number</option>
              <option value="year">By year</option>
            </select>
          </Field>
          <Field label="Public page">
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={publicEnabled} onChange={(e) => setPublicEnabled(e.target.checked)} />
              <span className="text-sm">Enabled</span>
            </label>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Cancel</button>
          <button disabled={submitting} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManagersDialog({ course, onClose }: { course: any; onClose: () => void }) {
  const listFn = useServerFn(listCourseManagers);
  const addFn = useServerFn(createCourseManager);
  const removeFn = useServerFn(removeCourseManager);
  const qc = useQueryClient();
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["course-managers", course.id],
    queryFn: () => listFn({ data: { course_id: course.id } } as any),
  });
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addFn({ data: { email, course_id: course.id, temp_password: pwd } } as any);
      toast.success("Manager added");
      setEmail(""); setPwd("");
      refetch();
      qc.invalidateQueries({ queryKey: ["my-courses"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Modal onClose={onClose} title={`Managers — ${course.name}`}>
      <div className="space-y-4">
        <div className="rounded-md border">
          {isLoading && <div className="p-3 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && data.length === 0 && <div className="p-3 text-sm text-muted-foreground">No managers yet.</div>}
          {data.map((m: any) => (
            <div key={m.user_id} className="flex items-center justify-between border-t px-3 py-2 first:border-t-0">
              <span className="text-sm">{m.email}</span>
              <button
                onClick={async () => {
                  if (!confirm("Remove access?")) return;
                  try {
                    await removeFn({ data: { user_id: m.user_id, course_id: course.id } } as any);
                    refetch();
                  } catch (e: any) { toast.error(e.message); }
                }}
                className="text-xs text-destructive hover:underline"
              >Remove</button>
            </div>
          ))}
        </div>
        <form onSubmit={add} className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Add manager</p>
          <input type="email" required placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <input type="text" required minLength={8} placeholder="Temporary password (min 8 chars)" value={pwd} onChange={(e) => setPwd(e.target.value)} className={inputCls} />
          <p className="text-xs text-muted-foreground">Share the temp password with them; they can change it after signing in.</p>
          <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add manager</button>
        </form>
      </div>
    </Modal>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function LogoCell({ course, onUpdated }: { course: any; onUpdated: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const updateFn = useServerFn(updateCourse);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `${course.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("course-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-logos").getPublicUrl(path);
      await updateFn({ data: { id: course.id, logo_url: data.publicUrl } } as any);
      toast.success("Logo updated");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await updateFn({ data: { id: course.id, logo_url: null } } as any);
      toast.success("Logo removed");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-white hover:border-primary disabled:opacity-50"
        title="Click to upload logo"
      >
        {course.logo_url ? (
          <img src={course.logo_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
          <Upload className="h-4 w-4" />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {course.logo_url && (
        <button type="button" onClick={remove} disabled={busy} className="text-xs text-muted-foreground hover:text-destructive">
          Remove
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

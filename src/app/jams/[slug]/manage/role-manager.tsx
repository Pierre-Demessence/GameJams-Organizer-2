"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  assignRoleAction,
  removeRoleAction,
  searchUsersForRole,
} from "./actions";
import { useRouter } from "next/navigation";

interface RoleEntry {
  id: string;
  userId: string;
  role: string;
  user: { username: string; displayName: string | null };
}

interface RoleManagerProps {
  jamId: string;
  creatorId: string;
  roles: RoleEntry[];
}

const ROLE_OPTIONS = ["ADMIN", "MODERATOR", "JUDGE", "HOST"] as const;

export function RoleManager({ jamId, creatorId, roles }: RoleManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; username: string; displayName: string | null }[]
  >([]);
  const [selectedRole, setSelectedRole] = useState<string>("JUDGE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSearch() {
    if (searchQuery.length < 2) return;
    const result = await searchUsersForRole(searchQuery);
    setSearchResults(result.users);
  }

  async function handleAssign(username: string) {
    setError("");
    setLoading(true);
    const result = await assignRoleAction(jamId, username, selectedRole);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSearchQuery("");
      setSearchResults([]);
      router.refresh();
    }
  }

  async function handleRemove(userId: string) {
    setError("");
    setLoading(true);
    const result = await removeRoleAction(jamId, userId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {r.user.displayName ?? r.user.username}
                </span>
                <span className="text-sm text-muted-foreground">
                  @{r.user.username}
                </span>
                <Badge variant="outline">{r.role}</Badge>
                {r.userId === creatorId && (
                  <Badge variant="secondary" className="text-xs">
                    Creator
                  </Badge>
                )}
              </div>
              {r.userId !== creatorId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleRemove(r.userId)}
                  disabled={loading}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add Role */}
      <Card>
        <CardHeader>
          <CardTitle>Add Team Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button type="button" variant="outline" onClick={handleSearch}>
              Search
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex gap-1">
              {ROLE_OPTIONS.map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant={selectedRole === role ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole(role)}
                >
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <span>
                    {user.displayName ?? user.username}{" "}
                    <span className="text-sm text-muted-foreground">
                      @{user.username}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleAssign(user.username)}
                    disabled={loading}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

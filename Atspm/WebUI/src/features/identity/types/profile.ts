// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - profile.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion

// GET /Profile has no declared success response schema in the backend's
// OpenAPI spec, so orval can't type it. This mirrors ProfileViewModel
// (IdentityApi/Models/Profile/ProfileViewModel.cs), whose Roles field is a
// single comma-joined string, not an array like UserDTO's.
export interface ProfileData {
  firstName: string
  lastName: string
  agency: string
  email: string
  phoneNumber: string
  roles: string
}

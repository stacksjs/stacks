import { Job } from "../../../orm/src/models/Job";

export async function processJobs(): Promise<void> {
  const jobs = await Job.all()

  for (const job of jobs) {
    console.log(job)
  }
}
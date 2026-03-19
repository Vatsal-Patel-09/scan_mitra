"use client";
import React, { useEffect, useMemo, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";

export const EcommerceMetrics = () => {
  const [clinicCount, setClinicCount] = useState<number | null>(null);
  const [doctorCount, setDoctorCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/clinics")
      .then((response) => response.json())
      .then((payload) => {
        if (!isMounted || !payload?.success || !Array.isArray(payload.data)) {
          return;
        }

        const totalClinics = payload.data.length;
        const totalDoctors = payload.data.reduce(
          (sum: number, clinic: { _count?: { doctors?: number } }) =>
            sum + (clinic._count?.doctors ?? 0),
          0
        );

        setClinicCount(totalClinics);
        setDoctorCount(totalDoctors);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setClinicCount(null);
        setDoctorCount(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const clinicsText = useMemo(
    () => (clinicCount === null ? "--" : clinicCount.toString()),
    [clinicCount]
  );

  const doctorsText = useMemo(
    () => (doctorCount === null ? "--" : doctorCount.toString()),
    [doctorCount]
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Active Centers
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {clinicsText}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            Live
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Doctors
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {doctorsText}
            </h4>
          </div>

          <Badge color="error">
            <ArrowDownIcon className="text-error-500" />
            Sync
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}
    </div>
  );
};

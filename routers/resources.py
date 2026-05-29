import psutil
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

def fmt_bytes(b: int) -> int:
    return b  # mandiamo i bytes raw, il frontend formatta

@router.get("")
def get_resources():
    # CPU
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count   = psutil.cpu_count()
    cpu_freq    = psutil.cpu_freq()

    # Memoria
    mem = psutil.virtual_memory()

    # Swap
    swap = psutil.swap_memory()

    # Temperatura
    temps = {}
    try:
        raw_temps = psutil.sensors_temperatures()
        for chip, entries in raw_temps.items():
            for e in entries:
                if e.current and e.current > 0:
                    label = e.label or chip
                    temps[label] = {
                        "current": round(e.current, 1),
                        "high":    round(e.high, 1) if e.high else None,
                        "critical":round(e.critical, 1) if e.critical else None,
                    }
    except AttributeError:
        pass  # Windows non supporta sensors_temperatures

    # Load average (1m, 5m, 15m)
    try:
        load1, load5, load15 = psutil.getloadavg()
    except Exception:
        load1 = load5 = load15 = 0.0

    # Disco — solo partizioni fisiche reali
    disks = []
    for part in psutil.disk_partitions(all=False):
        # Salta filesystem virtuali
        SKIP_FS  = {'tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'proc', 'sysfs', 'efivarfs', 'vfat'}
        SKIP_MNT = {'/boot', '/boot/efi'}
        if part.fstype in SKIP_FS or part.mountpoint in SKIP_MNT:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "mountpoint": part.mountpoint,
                "device":     part.device,
                "fstype":     part.fstype,
                "total":      usage.total,
                "used":       usage.used,
                "free":       usage.free,
                "percent":    usage.percent,
            })
        except PermissionError:
            continue

    # Rete — byte totali da boot, calcoliamo delta lato backend
    net_io = psutil.net_io_counters(pernic=True)
    network = []
    for iface, stats in net_io.items():
        # Salta loopback e interfacce inattive
        if iface == 'lo':
            continue
        if stats.bytes_sent == 0 and stats.bytes_recv == 0:
            continue
        network.append({
            "iface":       iface,
            "bytes_sent":  stats.bytes_sent,
            "bytes_recv":  stats.bytes_recv,
            "packets_sent": stats.packets_sent,
            "packets_recv": stats.packets_recv,
        })

    return {
        "cpu": {
            "percent": cpu_percent,
            "count":   cpu_count,
            "freq_mhz": round(cpu_freq.current, 0) if cpu_freq else None,
        },
        "mem": {
            "total":   mem.total,
            "used":    mem.used,
            "free":    mem.available,
            "percent": mem.percent,
        },
        "swap": {
            "total":   swap.total,
            "used":    swap.used,
            "free":    swap.free,
            "percent": swap.percent,
        } if swap.total > 0 else None,
        "temps": temps,
        "load": {
            "min1":  round(load1,  2),
            "min5":  round(load5,  2),
            "min15": round(load15, 2),
        },
        "disks":   disks,
        "network": network,
        "timestamp": datetime.now().isoformat(),
    }
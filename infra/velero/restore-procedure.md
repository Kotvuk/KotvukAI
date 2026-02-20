# KotvukAI Velero Restore Procedure

## List Available Backups

```bash
velero backup get
```

## Restore from Latest Backup

```bash
velero restore create --from-backup kotvukai-daily-backup-<YYYYMMDD>
```

## Restore Specific Resources

```bash
velero restore create \
  --from-backup kotvukai-daily-backup-<YYYYMMDD> \
  --include-resources deployments,services,secrets
```

## Monitor Restore Progress

```bash
velero restore describe <restore-name>
velero restore logs <restore-name>
```

## Verify After Restore

```bash
kubectl get pods -l app=kotvukai
kubectl get svc kotvukai-service
kubectl logs -l app=kotvukai --tail=50
```

## Troubleshooting

- If pods are in CrashLoopBackOff, check secrets: `kubectl get secret kotvukai-secrets -o yaml`
- If PVCs are pending, verify storage class availability
- For partial restore failures, check `velero restore logs <name>` for specific errors

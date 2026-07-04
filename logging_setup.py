import logging
import boto3
import watchtower
import config

def configure_logging():
    logger = logging.getLogger("cloudtask")
    logger.setLevel(logging.INFO)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logger.addHandler(console)

    try:
        cw_client = boto3.client("logs", region_name = config.AWS_REGION)
        cw_handler = watchtower.CloudWatchLogHandler(log_group="/cloudtask/cli",boto3_client=cw_client,)
        logger.addHandler(cw_handler)
    except Exception as e:
        logger.warning("CloudWatch logging unavailable: %s", e)

    return logger
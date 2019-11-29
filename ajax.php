<?php
session_write_close();
ini_set('log_errors', 1);
ini_set('error_log', 'error_log');
error_reporting(E_ALL);

file_put_contents('./post.txt', print_r($_REQUEST, 1));
/**
* Reads the requested portion of a file and sends its contents to the client with the appropriate headers.
* 
* This HTTP_RANGE compatible read file function is necessary for allowing streaming media to be skipped around in.
* 
* @param string $location
* @param string $filename
* @param string $mimeType
* @return void
* 
* @link https://groups.google.com/d/msg/jplayer/nSM2UmnSKKA/Hu76jDZS4xcJ
* @link http://php.net/manual/en/function.readfile.php#86244
*/
function smartReadFile($location, $filename, $mimeType = 'application/octet-stream')
{
	/*if (!file_exists($location))
	{
		header ("HTTP/1.1 404 Not Found");
		return;
	}*/
	
	$size	= filesize($location);
	$time	= date('r', filemtime($location));
	
	$fm		= @fopen($location, 'rb');
	if (!$fm)
	{
		#header ("HTTP/1.1 505 Internal server error");
		return;
	}
	
	$begin	= 0;
	$end  	= $size - 1;
	
	if (isset($_SERVER['HTTP_RANGE']))
	{
		if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches))
		{
			$begin	= intval($matches[1]);
			if (!empty($matches[2]))
			{
				$end	= intval($matches[2]);
			}
		}
	}
	if (isset($_SERVER['HTTP_RANGE']))
	{
		header('HTTP/1.1 206 Partial Content');
	}
	else
	{
		header('HTTP/1.1 200 OK');
	}
	
	header("Content-Type: $mimeType"); 
	header('Cache-Control: public, must-revalidate, max-age=0');
	header('Pragma: no-cache');  
	header('Accept-Ranges: bytes');
	header('Content-Length:' . (($end - $begin) + 1));
	if (isset($_SERVER['HTTP_RANGE']))
	{
		header("Content-Range: bytes $begin-$end/$size");
	}
	header("Content-Disposition: inline; filename=$filename");
	header("Content-Transfer-Encoding: binary");
	header("Last-Modified: $time");
	
	$cur	= $begin;
	fseek($fm, $begin, 0);
	
	while(!feof($fm) && $cur <= $end && (connection_status() == 0))
	{
		print fread($fm, min(1024 * 16, ($end - $cur) + 1));
		$cur += 1024 * 16;
	}
}
if (isset($_GET['serve'])) {
	smartReadFile($_GET['serve'], $_GET['filename'], 'audio/mpeg, audio/x-mpeg, audio/x-mpeg-3, audio/mpeg3');
} else if (isset($_REQUEST['updatePlay'])) {
	session_start();
	$play = json_decode(@file_get_contents('play.json') ?: '[]', true);
	$_POST['time'] = microtime(true);
	$play = array_replace($play, $_POST);
	echo $json = json_encode($play, JSON_NUMERIC_CHECK | JSON_PRESERVE_ZERO_FRACTION);
	file_put_contents('play.json', $json);
} else if (isset($_REQUEST['updateTime'])) {
	session_start();
	$time = json_decode(@file_get_contents('time.json') ?: '[]', true);
	$_POST['time'] = microtime(true);
	$time = array_replace($time, $_POST);
	echo $json = json_encode($time, JSON_NUMERIC_CHECK | JSON_PRESERVE_ZERO_FRACTION);
	file_put_contents('time.json', $json);
} else if (isset($_GET['save']) && isset($_POST['data'])) {
	file_put_contents($_GET['save'], file_get_contents($_POST['data']));
}

else {
	file_put_contents('./post.txt', print_r($_REQUEST, 1));
}
<?xml version="1.0"?>
 
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:geonet="http://www.fao.org/geonetwork"
	xmlns:xalan = "http://xml.apache.org/xalan">
<xsl:output method="xml"/>

<xsl:include href="../../xsl/metadata-utils.xsl"/>

<xsl:template match="/">

	<xsl:variable name="md">
		<xsl:apply-templates mode="brief" select="*"/>
	</xsl:variable>
	<xsl:variable name="metadata" select="xalan:nodeset($md)/*[1]"/>
	
	<!--
	B: includes the Title (title) element.
	-->
	<metadata>
	  <idinfo>
		<citation>
		  <citeinfo>
			<title><xsl:value-of select="$metadata/title"/></title>
		  </citeinfo>
		</citation>
	  </idinfo>
	</metadata>

</xsl:template>

</xsl:stylesheet>
